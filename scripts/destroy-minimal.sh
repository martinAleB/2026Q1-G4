#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${SCRIPT_DIR}/terraform"

echo "======================================================================"
echo "Iniciando destrucción MÍNIMA (Solo API y Frontend)"
echo "======================================================================"

# --- 1. Validar variables de entorno ---
if [ -z "$TF_STATE_BUCKET" ] || [ -z "$TF_LOCK_TABLE" ] || [ -z "$TF_FRONTEND_BUCKET_NAME" ]; then
  echo "Faltan variables de entorno indispensables:"
  echo "  export TF_STATE_BUCKET=<nombre-del-bucket-estado>"
  echo "  export TF_LOCK_TABLE=<nombre-de-la-tabla-lock>"
  echo "  export TF_FRONTEND_BUCKET_NAME=<nombre-del-bucket-frontend>"
  exit 1
fi

TF_INIT_ARGS=(
  -backend-config="bucket=${TF_STATE_BUCKET}"
  -backend-config="key=terraform.tfstate"
  -backend-config="region=us-east-1"
  -backend-config="dynamodb_table=${TF_LOCK_TABLE}"
)

# --- 2. Vaciar el bucket de S3 primero ---
# Terraform no puede borrar un bucket si tiene archivos adentro.
echo "==> Vaciando bucket de S3: ${TF_FRONTEND_BUCKET_NAME}"
if aws s3 ls "s3://${TF_FRONTEND_BUCKET_NAME}" 2>&1 | grep -q 'NoSuchBucket'; then
  echo "El bucket ya no existe o no se puede acceder. Continuando..."
else
  # Usamos --quiet para no llenar la consola si hay muchos archivos
  aws s3 rm "s3://${TF_FRONTEND_BUCKET_NAME}" --recursive --quiet || true
  echo "Bucket vaciado."
fi

# --- 3. Terraform init + destroy (TARGENTEADO) ---
echo "==> Inicializando Terraform"
cd "${TF_DIR}"
terraform init -reconfigure "${TF_INIT_ARGS[@]}"

echo "==> Ejecutando Terraform Destroy (Targeted)"
terraform destroy -auto-approve \
  -target=aws_dynamodb_table.simulations \
  -target=aws_sqs_queue.simulations \
  -target=aws_lambda_function.simulations_handler \
  -target=aws_lambda_function.simulations_engine \
  -target=aws_lambda_function.simulations_results \
  -target=aws_apigatewayv2_api.simulations_api \
  -target=aws_apigatewayv2_route.post_simulations \
  -target=aws_apigatewayv2_route.get_simulations \
  -target=aws_apigatewayv2_integration.handler_integration \
  -target=aws_apigatewayv2_integration.results_integration \
  -target=aws_lambda_permission.api_gw_handler \
  -target=aws_lambda_permission.api_gw_results \
  -target=aws_apigatewayv2_stage.simulations_stage \
  -target=aws_lambda_event_source_mapping.sqs_to_engine \
  -target=aws_s3_bucket.frontend \
  -target=aws_s3_bucket_versioning.frontend \
  -target=aws_s3_bucket_ownership_controls.frontend \
  -target=aws_s3_bucket_public_access_block.frontend \
  -target=aws_s3_bucket_website_configuration.frontend

echo ""
echo "======================================================================"
echo "¡Destrucción MINIMA completada con éxito!"
echo "======================================================================"
