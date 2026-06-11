import json
import os
import ssl
import time
import urllib.request
import urllib.error
from decimal import Decimal
from pathlib import Path
import datetime
import boto3
import numpy as np
import pg8000.native

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
s3 = boto3.client('s3')
secretsmanager = boto3.client('secretsmanager')
DYNAMODB_TABLE         = os.environ.get('DYNAMODB_TABLE_NAME')
DYNAMODB_FINTECH_TABLE = os.environ.get('DYNAMODB_FINTECH_TABLE')
SQS_QUEUE_URL          = os.environ.get('SQS_QUEUE_URL')
MODEL_ARTIFACTS_BUCKET = os.environ.get('MODEL_ARTIFACTS_BUCKET')
MODEL_ARTIFACTS_PREFIX = os.environ.get('MODEL_ARTIFACTS_PREFIX', 'v1/')
DB_HOST                = os.environ.get('DB_HOST')
DB_PORT                = int(os.environ.get('DB_PORT', '5432'))
DB_NAME                = os.environ.get('DB_NAME')
DB_SECRET_ARN          = os.environ.get('DB_SECRET_ARN')
_db_credentials        = json.loads(secretsmanager.get_secret_value(SecretId=DB_SECRET_ARN)['SecretString'])
DB_USER                = _db_credentials['username']
DB_PASSWORD            = _db_credentials['password']


def _required_env(name: str) -> str:
    """Falla en cold start si la env var no está. Si una de estas falta el
    Lambda no puede funcionar correctamente (silenciosamente caería a
    defaults o saltearía writes), así que es preferible que CloudWatch
    muestre un init error visible en métricas antes de procesar mensajes.
    """
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Required env var {name} is not set")
    return value

RETRY_DELAYS = [60, 120, 240, 480]

# Reintentos in-process para llamadas puntuales a DynamoDB (lecturas de
# parámetros de la fintech y escrituras de estado de simulación). Cubren
# blips transitorios (throttling, fallos de red breves) sin tener que
# devolver el mensaje a SQS, que conlleva re-llamar al BCRA.
DDB_MAX_ATTEMPTS = 3
DDB_BASE_DELAY_S = 0.5

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
    """Lee los parámetros generales de la fintech de DynamoDB.

    Reintenta unas pocas veces ante fallos transitorios y, si todos los
    intentos fallan, cae a los defaults para no bloquear la simulación.
    Si falta algún campo individual en el item, también se completa con default.
    """
    last_error = None
    item = None
    for attempt in range(DDB_MAX_ATTEMPTS):
        try:
            response = dynamodb.get_item(
                TableName=DYNAMODB_FINTECH_TABLE,
                Key={"sub": {"S": sub}},
            )
            item = response.get('Item', {})
            break
        except Exception as e:
            last_error = e
            print(f"Error leyendo fintech params para {sub} (intento {attempt + 1}/{DDB_MAX_ATTEMPTS}): {str(e)}")
            if attempt < DDB_MAX_ATTEMPTS - 1:
                time.sleep(DDB_BASE_DELAY_S * (2 ** attempt))

    if item is None:
        print(f"No se pudieron leer fintech params para {sub} tras {DDB_MAX_ATTEMPTS} intentos. Usando defaults. Último error: {last_error}")
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
    """Persiste el estado de la simulación en DynamoDB.

    Reintenta ante fallos transitorios. Si todos los intentos fallan, levanta
    excepción para que el caller decida (típicamente re-encolar via SQS con
    attempt++) en vez de dejar la simulación colgada en PROCESSING.
    """
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

    last_error = None
    for attempt in range(DDB_MAX_ATTEMPTS):
        try:
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
            return
        except Exception as e:
            last_error = e
            print(f"Error actualizando DynamoDB para {task_id} (intento {attempt + 1}/{DDB_MAX_ATTEMPTS}): {str(e)}")
            if attempt < DDB_MAX_ATTEMPTS - 1:
                time.sleep(DDB_BASE_DELAY_S * (2 ** attempt))

    raise Exception(f"No se pudo actualizar DynamoDB para {task_id} tras {DDB_MAX_ATTEMPTS} intentos: {last_error}")

def cargar_artefactos():
    global _INTERPRETER, _SCALER_PARAMS, _FEATURE_COLUMNS, _FILL_VALUES
    if _INTERPRETER is not None:
        return

    print("Cargando artefactos desde S3 (Cold Start)...")
    tmp_dir = Path("/tmp/artifacts")
    tmp_dir.mkdir(parents=True, exist_ok=True)
    for name in ("modelo_crediticio.tflite", "scaler_params.json",
                 "feature_columns.json", "feature_fill_values.json"):
        local = tmp_dir / name
        if not local.exists():
            s3.download_file(MODEL_ARTIFACTS_BUCKET,
                             f"{MODEL_ARTIFACTS_PREFIX}{name}", str(local))

    _SCALER_PARAMS   = _read_json(tmp_dir / "scaler_params.json")
    _INTERPRETER     = tflite_interpreter(model_path=str(tmp_dir / "modelo_crediticio.tflite"))
    _INTERPRETER.allocate_tensors()
    _FEATURE_COLUMNS = _read_json(tmp_dir / "feature_columns.json")
    _FILL_VALUES     = _read_json(tmp_dir / "feature_fill_values.json")
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

def persist_features_to_rds(cuit: str, features: dict, score: float):
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    conn = pg8000.native.Connection(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        ssl_context=ssl_ctx,
    )
    try:
        conn.run(
            """
            INSERT INTO portfolio_cuits (
                cuit, current_status, previous_status, trend, situacion, cant_entidades, deuda_total_ars,
                meses_en_sit1, dias_atraso_max, proceso_judicial, score, features_updated_at, last_updated
            ) VALUES (
                :cuit, :sit, :sit, 'stable', :sit, :cant, :deuda, :meses, :dias, :proceso, :score, NOW(), NOW()
            )
            ON CONFLICT (cuit) DO UPDATE SET
                previous_status      = CASE 
                                            WHEN portfolio_cuits.current_status = 0 THEN EXCLUDED.current_status 
                                            ELSE portfolio_cuits.current_status 
                                       END,
                current_status       = EXCLUDED.current_status,
                trend                = CASE
                                            WHEN portfolio_cuits.current_status = 0 OR portfolio_cuits.current_status = EXCLUDED.current_status THEN 'stable'
                                            WHEN EXCLUDED.current_status > portfolio_cuits.current_status THEN 'down'
                                            ELSE 'up'
                                       END,
                situacion            = EXCLUDED.situacion,
                cant_entidades       = EXCLUDED.cant_entidades,
                deuda_total_ars      = EXCLUDED.deuda_total_ars,
                meses_en_sit1        = EXCLUDED.meses_en_sit1,
                dias_atraso_max      = EXCLUDED.dias_atraso_max,
                proceso_judicial     = EXCLUDED.proceso_judicial,
                score                = EXCLUDED.score,
                features_updated_at  = EXCLUDED.features_updated_at,
                last_updated         = NOW()
            """,
            cuit=cuit,
            sit=int(features.get('situacion', 0)),
            cant=int(features.get('cant_entidades', 0)),
            deuda=float(features.get('prestamos_total', 0)) * 1000,
            meses=int(features.get('meses_en_sit1', 0)),
            dias=int(features.get('dias_atraso_max', 0)),
            proceso=bool(int(features.get('proceso_judicial', 0))),
            score=score,
        )
    finally:
        conn.close()


def persist_no_data_to_rds(cuit: str):
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    conn = pg8000.native.Connection(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        ssl_context=ssl_ctx,
    )
    try:
        conn.run(
            """
            INSERT INTO portfolio_cuits (
                cuit, current_status, previous_status, trend, situacion, last_updated
            ) VALUES (
                :cuit, 0, 0, 'stable', 0, NOW()
            )
            ON CONFLICT (cuit) DO UPDATE SET
                current_status       = 0,
                situacion            = 0,
                last_updated         = NOW()
            """,
            cuit=cuit,
        )
    finally:
        conn.close()


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

            score = predecir_score(features)
            print(f"Score calculado: {score}")

            persist_features_to_rds(cuit, features, score)

            fintech_params = get_fintech_params(sub)
            rejection_reasons = apply_filter(features, fintech_params)
            if rejection_reasons:
                print(f"Cliente rechazado por política de fintech: {rejection_reasons}")
                update_simulation_status(sub, cuit, task_id, "REJECTED", score=score, rejection_reasons=rejection_reasons)
                continue

            update_simulation_status(sub, cuit, task_id, "COMPLETED", score=score)

        except NoRetryError as e:
            print(f"Sin datos para {task_id}: {str(e)}")
            if task_id and sub and cuit:
                try:
                    persist_no_data_to_rds(cuit)
                except Exception as db_err:
                    print(f"Error persisting no_data to RDS for {cuit}: {str(db_err)}")
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
