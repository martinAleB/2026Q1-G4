import json
import os
import urllib.request
import urllib.error
from decimal import Decimal
from pathlib import Path
import datetime
import boto3
import numpy as np

# Importar LiteRT (antes tflite-runtime) para Python 3.12+
try:
    from ai_edge_litert.interpreter import Interpreter as tflite_interpreter
    print("LiteRT (ai_edge_litert) cargado exitosamente")
except ImportError as e:
    try:
        import tflite_runtime.interpreter as tflite_interpreter
        print("tflite_runtime cargado exitosamente")
    except ImportError as e2:
        raise ImportError(f"Error cargando TFLite/LiteRT. Intento 1 (LiteRT): {str(e)}. Intento 2 (TFLite): {str(e2)}")

_INTERPRETER = None
_SCALER_PARAMS = None
_FEATURE_COLUMNS = None
_FILL_VALUES = None

dynamodb = boto3.client('dynamodb')
sqs = boto3.client('sqs')
DYNAMODB_TABLE         = os.environ.get('DYNAMODB_TABLE_NAME')
DYNAMODB_FINTECH_TABLE = os.environ.get('DYNAMODB_FINTECH_TABLE')
SQS_QUEUE_URL          = os.environ.get('SQS_QUEUE_URL')

RETRY_DELAYS = [60, 120, 240, 480]

FINTECH_DEFAULTS = {
    'max_situacion_crediticia': 2,
    'max_entidades_con_deuda':  3,
    'max_deuda_total_ars':      350000,
    'min_meses_situacion_1':    6,
    'max_dias_atraso':          30,
    'permite_proceso_judicial': False,
}

class NoRetryError(Exception):
    pass

def _parse_monto_24dsf(valor) -> float:
    try:
        return float(str(valor).strip().replace(',', '.').replace(' ', ''))
    except (ValueError, TypeError):
        return 0.0

def _parse_situacion_24dsf(valor) -> int | None:
    try:
        if valor is None or str(valor).strip() == "":
            return None
        sit = int(float(str(valor).replace(',', '.')))
        return sit if 1 <= sit <= 5 else None
    except (ValueError, TypeError):
        return None

def features_desde_api(response_json: dict) -> dict | None:
    periodos = response_json.get('periodos', [])
    if len(periodos) < 7:
        return None

    meses = []
    for p in periodos:
        entidades = p.get('entidades', [])
        if not entidades:
            continue

        situaciones_validas = []
        for e in entidades:
            sit = _parse_situacion_24dsf(e.get('situacion'))
            if sit is not None:
                situaciones_validas.append(sit)
        
        if not situaciones_validas:
            continue

        meses.append({
            'periodo': p.get('periodo'),
            'situacion_max': max(situaciones_validas),
            'monto_total': sum(_parse_monto_24dsf(e.get('monto', 0)) for e in entidades),
            'dias_atraso_max': max(int(e.get('diasAtrasoPago') or 0) for e in entidades),
            'refinanciado': any(e.get('refinanciaciones') for e in entidades),
            'proceso_judicial': any(e.get('procesoJud') for e in entidades),
            'recategorizado': any(e.get('recategorizacionOblig') for e in entidades),
            'irrecuperable': any(e.get('irrecDisposicionTecnica') for e in entidades),
            'cant_entidades': len(entidades),
        })

    if len(meses) < 7:
        return None

    mes_actual = meses[0]
    hist = meses[6:]

    features = {
        'situacion': mes_actual['situacion_max'],
        'prestamos_total': mes_actual['monto_total'],
        'dias_atraso_max': mes_actual['dias_atraso_max'],
        'tiene_garantia_a': 0,
        'ratio_cobertura': 0.0,
        'refinanciado': int(mes_actual['refinanciado']),
        'proceso_judicial': int(mes_actual['proceso_judicial']),
        'recategorizado': int(mes_actual['recategorizado']),
        'irrecuperable': int(mes_actual['irrecuperable']),
        'cant_entidades': mes_actual['cant_entidades'],
    }

    sits = [m['situacion_max'] for m in hist]
    montos = [m['monto_total'] for m in hist]

    meses_en_sit1 = sum(1 for s in sits if s == 1)
    meses_sit_mala = sum(1 for s in sits if s >= 3)
    peor_situacion_24m = max(sits) if sits else 1
    
    if len(sits) >= 4:
        bloque = sits[3:12]
        tendencia = round((sum(sits[:3]) / 3) - (sum(bloque) / len(bloque)), 3) if bloque else 0.0
    else:
        tendencia = 0.0

    racha = 0
    for s in sits:
        if s == 1:
            racha += 1
        else:
            break

    monto_actual_hist = montos[0] if len(montos) >= 1 else 0
    monto_hace_12 = montos[11] if len(montos) >= 12 else (montos[-1] if montos else 0)
    variacion_monto_12m = (
        round((monto_actual_hist - monto_hace_12) / monto_hace_12, 3)
        if monto_hace_12 > 0
        else 0.0
    )

    monto_promedio_24m = round(sum(montos) / len(montos), 1) if montos else 0.0
    monto_max_24m = max(montos) if montos else 0.0
    meses_con_deuda = sum(1 for m in montos if m > 0)

    features.update({
        'meses_en_sit1': meses_en_sit1,
        'meses_sit_mala': meses_sit_mala,
        'peor_situacion_24m': peor_situacion_24m,
        'tendencia_situacion': tendencia,
        'racha_sit1_actual': racha,
        'variacion_monto_12m': variacion_monto_12m,
        'monto_promedio_24m': monto_promedio_24m,
        'monto_max_24m': monto_max_24m,
        'meses_con_deuda': meses_con_deuda,
        'actividad': 'desconocido',
    })

    return features

def _read_json(path: Path):
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def get_fintech_params(sub: str) -> dict:
    """Lee los parámetros generales de la fintech de DynamoDB. Si falta algún campo, usa defaults."""
    if not DYNAMODB_FINTECH_TABLE:
        print("DYNAMODB_FINTECH_TABLE no definida, usando defaults.")
        return dict(FINTECH_DEFAULTS)

    try:
        response = dynamodb.get_item(
            TableName=DYNAMODB_FINTECH_TABLE,
            Key={"sub": {"S": sub}},
        )
        item = response.get('Item', {})
    except Exception as e:
        print(f"Error leyendo fintech params para {sub}: {str(e)}. Usando defaults.")
        return dict(FINTECH_DEFAULTS)

    params = dict(FINTECH_DEFAULTS)
    if 'max_situacion_crediticia' in item:
        params['max_situacion_crediticia'] = int(item['max_situacion_crediticia']['N'])
    if 'max_entidades_con_deuda' in item:
        params['max_entidades_con_deuda'] = int(item['max_entidades_con_deuda']['N'])
    if 'max_deuda_total_ars' in item:
        params['max_deuda_total_ars'] = float(item['max_deuda_total_ars']['N'])
    if 'min_meses_situacion_1' in item:
        params['min_meses_situacion_1'] = int(item['min_meses_situacion_1']['N'])
    if 'max_dias_atraso' in item:
        params['max_dias_atraso'] = int(item['max_dias_atraso']['N'])
    if 'permite_proceso_judicial' in item:
        params['permite_proceso_judicial'] = bool(item['permite_proceso_judicial'].get('BOOL', False))
    return params

def apply_filter(features: dict, params: dict) -> list:
    """Aplica los umbrales generales de la fintech sobre las features del BCRA.
    Retorna lista de razones de rechazo (vacía si pasa todas las reglas)."""
    reasons = []

    sit = int(features.get('situacion', 0))
    if sit > params['max_situacion_crediticia']:
        reasons.append(f"situacion_actual={sit} > max_situacion_crediticia={params['max_situacion_crediticia']}")

    cant_ent = int(features.get('cant_entidades', 0))
    if cant_ent > params['max_entidades_con_deuda']:
        reasons.append(f"cant_entidades={cant_ent} > max_entidades_con_deuda={params['max_entidades_con_deuda']}")

    # `prestamos_total` viene del BCRA 24DSF en miles de pesos -> pasamos a pesos
    deuda_total_ars = float(features.get('prestamos_total', 0)) * 1000
    if deuda_total_ars > params['max_deuda_total_ars']:
        reasons.append(f"deuda_total_ars={deuda_total_ars:.0f} > max_deuda_total_ars={params['max_deuda_total_ars']}")

    meses_sit1 = int(features.get('meses_en_sit1', 0))
    if meses_sit1 < params['min_meses_situacion_1']:
        reasons.append(f"meses_en_sit1={meses_sit1} < min_meses_situacion_1={params['min_meses_situacion_1']}")

    dias_atraso = int(features.get('dias_atraso_max', 0))
    if dias_atraso > params['max_dias_atraso']:
        reasons.append(f"dias_atraso={dias_atraso} > max_dias_atraso={params['max_dias_atraso']}")

    proceso_jud = int(features.get('proceso_judicial', 0)) == 1
    if proceso_jud and not params['permite_proceso_judicial']:
        reasons.append("proceso_judicial=True y permite_proceso_judicial=False")

    return reasons

def update_simulation_status(sub: str, cuit: str, task_id: str, status: str, score: float = None, error: str = None, rejection_reasons: list = None):
    if not DYNAMODB_TABLE:
        print("DYNAMODB_TABLE_NAME no definida, omitiendo guardado.")
        return

    try:
        update_expression = "SET #st = :status, updated_at = :now"
        expression_values = {
            ":status": {"S": status},
            ":now": {"S": datetime.datetime.now(datetime.timezone.utc).isoformat()}
        }
        expression_names = {"#st": "status"}

        if score is not None:
            update_expression += ", score = :score"
            expression_values[":score"] = {"N": str(score)}

        if error is not None:
            update_expression += ", error_message = :error"
            expression_values[":error"] = {"S": str(error)}

        if rejection_reasons is not None:
            update_expression += ", rejection_reasons = :reasons"
            expression_values[":reasons"] = {"L": [{"S": r} for r in rejection_reasons]}

        dynamodb.update_item(
            TableName=DYNAMODB_TABLE,
            Key={
                "sub": {"S": sub},
                "sk":  {"S": f"CUIT#{cuit}#TASK#{task_id}"}
            },
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values,
            ExpressionAttributeNames=expression_names
        )
        print(f"Estado en DB actualizado a {status} para {task_id}")
    except Exception as e:
        print(f"Error actualizando DynamoDB para {task_id}: {str(e)}")

def cargar_artefactos():
    global _INTERPRETER, _SCALER_PARAMS, _FEATURE_COLUMNS, _FILL_VALUES
    if _INTERPRETER is not None:
        return
        
    print("Cargando artefactos en memoria (Cold Start)...")
    artifacts_dir = Path(__file__).resolve().parent / "artifacts"
    
    _SCALER_PARAMS = _read_json(artifacts_dir / "scaler_params.json")
    _INTERPRETER = tflite_interpreter(model_path=str(artifacts_dir / "modelo_crediticio.tflite"))
    _INTERPRETER.allocate_tensors()
    _FEATURE_COLUMNS = _read_json(artifacts_dir / "feature_columns.json")
    _FILL_VALUES = _read_json(artifacts_dir / "feature_fill_values.json")
    print("Artefactos cargados.")

def consultar_bcra(cuit: str) -> dict:
    import requests
    url = f"https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas/Historicas/{cuit}"
    headers = {
        'Cache-Control': 'no-cache',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        return data.get('results', {})
    except requests.exceptions.HTTPError as e:
        if response.status_code == 404:
            raise NoRetryError(f"El CUIT {cuit} no posee historial en BCRA (HTTP 404).")
        raise Exception(f"Error consultando BCRA: HTTP {response.status_code}")
    except NoRetryError:
        raise
    except Exception as e:
        raise Exception(f"Error de conexión con BCRA: {str(e)}")

def predecir_score(features_dict: dict) -> float:
    import numpy as np
    
    cargar_artefactos()
    
    input_data = []
    for col in _FEATURE_COLUMNS:
        if col.startswith("actividad_"):
            val = 1.0 if f"actividad_{features_dict.get('actividad', 'desconocido')}" == col else 0.0
        else:
            val = float(features_dict.get(col, _FILL_VALUES.get(col, 0.0)))
        input_data.append(val)
    
    means = _SCALER_PARAMS['mean']
    scales = _SCALER_PARAMS['scale']
    scaled_data = [(v - m) / s for v, m, s in zip(input_data, means, scales)]
    
    input_details = _INTERPRETER.get_input_details()
    output_details = _INTERPRETER.get_output_details()
    
    input_array = np.array([scaled_data], dtype=np.float32)
    
    _INTERPRETER.set_tensor(input_details[0]['index'], input_array)
    _INTERPRETER.invoke()
    preds = _INTERPRETER.get_tensor(output_details[0]['index'])
    
    return float(preds[0][0])

def lambda_handler(event, context):
    for record in event.get('Records', []):
        task_id = None
        cuit = None
        sub = None
        body = {}
        attempt = 0
        try:
            body = json.loads(record['body'])
            task_id = body.get('task_id')
            cuit = body.get('cuit')
            sub = body.get('sub')
            attempt = body.get('attempt', 0)

            if not task_id or not cuit or not sub:
                print("Mensaje inválido, faltan campos requeridos, ignorando.")
                continue

            print(f"Procesando Task: {task_id} - CUIT: {cuit} - Sub: {sub} - Intento: {attempt}")

            bcra_data = consultar_bcra(cuit)

            features = features_desde_api(bcra_data)
            if features is None:
                raise NoRetryError("No hay suficientes periodos en BCRA (min 7).")

            fintech_params = get_fintech_params(sub)
            rejection_reasons = apply_filter(features, fintech_params)
            if rejection_reasons:
                print(f"Cliente rechazado por política de fintech: {rejection_reasons}")
                update_simulation_status(sub, cuit, task_id, "REJECTED", rejection_reasons=rejection_reasons)
                continue

            score = predecir_score(features)
            print(f"Score calculado: {score}")

            update_simulation_status(sub, cuit, task_id, "COMPLETED", score=score)

        except NoRetryError as e:
            print(f"Sin datos para {task_id}: {str(e)}")
            if task_id and sub and cuit:
                update_simulation_status(sub, cuit, task_id, "NO_DATA", error=str(e))

        except Exception as e:
            print(f"Error procesando (intento {attempt}): {str(e)}")
            if task_id and sub and cuit:
                if attempt < len(RETRY_DELAYS):
                    delay = RETRY_DELAYS[attempt]
                    print(f"Reintentando en {delay}s (intento {attempt + 1}/{len(RETRY_DELAYS)})")
                    sqs.send_message(
                        QueueUrl=SQS_QUEUE_URL,
                        MessageBody=json.dumps({
                            'task_id':   task_id,
                            'cuit':      cuit,
                            'sub':       sub,
                            'timestamp': body.get('timestamp'),
                            'attempt':   attempt + 1
                        }),
                        DelaySeconds=delay
                    )
                else:
                    print(f"Reintentos agotados para {task_id}, marcando FAILED.")
                    update_simulation_status(sub, cuit, task_id, "FAILED", error=str(e))

    return {"statusCode": 200, "body": "OK"}
