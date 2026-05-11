import json
import os
import urllib.request
import urllib.error
from decimal import Decimal
from pathlib import Path

import pandas as pd
import numpy as np
import joblib
import tflite_runtime.interpreter as tflite
import boto3
import datetime

from engine.src.preprocessing.load_data import features_desde_api
from engine.src.model.predict import (
    FEATURE_COLUMNS, 
    _read_feature_columns, 
    _read_fill_values, 
    _build_features
)

_INTERPRETER = None
_SCALER = None
_FEATURE_COLUMNS = None
_FILL_VALUES = None

dynamodb = boto3.client('dynamodb')
DYNAMODB_TABLE = os.environ.get('DYNAMODB_TABLE_NAME')

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
    global _INTERPRETER, _SCALER, _FEATURE_COLUMNS, _FILL_VALUES
    if _INTERPRETER is not None:
        return
        
    print("Cargando artefactos en memoria (Cold Start)...")
    artifacts_dir = Path(__file__).resolve().parent / "artifacts"
    
    _SCALER = joblib.load(artifacts_dir / "scaler.joblib")
    _INTERPRETER = tflite.Interpreter(model_path=str(artifacts_dir / "modelo_crediticio.tflite"))
    _INTERPRETER.allocate_tensors()
    _FEATURE_COLUMNS = _read_feature_columns(artifacts_dir / "feature_columns.json")
    _FILL_VALUES = _read_fill_values(artifacts_dir / "feature_fill_values.json")
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
    cargar_artefactos()
    
    if 'nro_id' not in features_dict:
        features_dict['nro_id'] = "temp_id"
        
    df = pd.DataFrame([features_dict], columns=["nro_id"] + FEATURE_COLUMNS)
    
    X, _ = _build_features(df)
    X = X.reindex(columns=_FEATURE_COLUMNS, fill_value=0)
    X = X.replace([np.inf, -np.inf], np.nan)
    
    if _FILL_VALUES:
        X = X.fillna(pd.Series(_FILL_VALUES))
    X = X.fillna(0.0)
    
    X_scaled = _SCALER.transform(X)
    
    input_details = _INTERPRETER.get_input_details()
    output_details = _INTERPRETER.get_output_details()
    
    _INTERPRETER.set_tensor(input_details[0]['index'], X_scaled.astype(np.float32))
    _INTERPRETER.invoke()
    preds = _INTERPRETER.get_tensor(output_details[0]['index']).reshape(-1)
    
    return float(preds[0])

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
