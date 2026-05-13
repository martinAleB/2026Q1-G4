import json
import os
import urllib.request
import urllib.error
from decimal import Decimal
from pathlib import Path
import datetime
import boto3

try:
    import tflite_runtime.interpreter as tflite
except ImportError:
    import tensorflow.lite as tflite

_INTERPRETER = None
_SCALER_PARAMS = None
_FEATURE_COLUMNS = None
_FILL_VALUES = None

dynamodb = boto3.client('dynamodb')
DYNAMODB_TABLE = os.environ.get('DYNAMODB_TABLE_NAME')

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

def update_simulation_status(fintech_id: str, timestamp: str, task_id: str, status: str, score: float = None, error: str = None):
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
            
        dynamodb.update_item(
            TableName=DYNAMODB_TABLE,
            Key={
                "pk": {"S": f"FINTECH#{fintech_id}"},
                "sk": {"S": f"TASK#{timestamp}#{task_id}"}
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
    _INTERPRETER = tflite.Interpreter(model_path=str(artifacts_dir / "modelo_crediticio.tflite"))
    _INTERPRETER.allocate_tensors()
    _FEATURE_COLUMNS = _read_json(artifacts_dir / "feature_columns.json")
    _FILL_VALUES = _read_json(artifacts_dir / "feature_fill_values.json")
    print("Artefactos cargados.")

def consultar_bcra(cuit: str) -> dict:
    url = f"https://api.bcra.gob.ar/centraldedeudores/v1/Deudas/Historicas/{cuit}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return data.get('results', {})
    except urllib.error.HTTPError as e:
        raise Exception(f"Error consultando BCRA: HTTP {e.code}")
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
        fintech_id = None
        timestamp = None
        try:
            body = json.loads(record['body'])
            task_id = body.get('task_id')
            cuit = body.get('cuit')
            fintech_id = body.get('fintech_id')
            timestamp = body.get('timestamp')
            
            if not task_id or not cuit or not fintech_id or not timestamp:
                print("Mensaje inválido, faltan campos requeridos, ignorando.")
                continue
                
            print(f"Procesando Task: {task_id} - CUIT: {cuit} - Fintech: {fintech_id}")
            
            bcra_data = consultar_bcra(cuit)
            
            features = features_desde_api(bcra_data)
            if features is None:
                raise ValueError("No hay suficientes periodos en BCRA (min 7).")
                
            score = predecir_score(features)
            print(f"Score calculado: {score}")
            
            update_simulation_status(fintech_id, timestamp, task_id, "COMPLETED", score=score)
            
        except Exception as e:
            print(f"Error procesando: {str(e)}")
            if task_id and fintech_id and timestamp:
                update_simulation_status(fintech_id, timestamp, task_id, "FAILED", error=str(e))
            
    return {"statusCode": 200, "body": "OK"}

def lambda_handler(event, context):
    for record in event.get('Records', []):
        task_id = None
        cuit = None
        fintech_id = None
        timestamp = None
        try:
            body = json.loads(record['body'])
            task_id = body.get('task_id')
            cuit = body.get('cuit')
            fintech_id = body.get('fintech_id')
            timestamp = body.get('timestamp')
            
            if not task_id or not cuit or not fintech_id or not timestamp:
                print("Mensaje inválido, faltan campos requeridos, ignorando.")
                continue
                
            print(f"Procesando Task: {task_id} - CUIT: {cuit} - Fintech: {fintech_id}")
            
            bcra_data = consultar_bcra(cuit)
            
            features = features_desde_api(bcra_data)
            if features is None:
                raise ValueError("No hay suficientes periodos en BCRA (min 7).")
                
            score = predecir_score(features)
            print(f"Score calculado: {score}")
            
            update_simulation_status(fintech_id, timestamp, task_id, "COMPLETED", score=score)
            
        except Exception as e:
            print(f"Error procesando: {str(e)}")
            if task_id and fintech_id and timestamp:
                update_simulation_status(fintech_id, timestamp, task_id, "FAILED", error=str(e))
            
    return {"statusCode": 200, "body": "OK"}
