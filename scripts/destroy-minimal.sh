#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${SCRIPT_DIR}/scripts/env.sh"

TF_DIR="${SCRIPT_DIR}/terraform"

echo "======================================================================"
echo "Iniciando destrucción MÍNIMA (Solo API y Frontend)"
echo "======================================================================"

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
  -target=module.dynamodb_simulations \
  -target=aws_sqs_queue.main \
  "-target=aws_lambda_function.lambdas[\"simulations-handler\"]" \
  "-target=aws_lambda_function.lambdas[\"simulations-engine\"]" \
  "-target=aws_lambda_function.lambdas[\"simulations-results\"]" \
  -target=aws_apigatewayv2_api.main \
  "-target=aws_apigatewayv2_route.routes[\"simulations-post\"]" \
  "-target=aws_apigatewayv2_route.routes[\"simulations-get\"]" \
  "-target=aws_apigatewayv2_integration.lambdas[\"simulations-handler\"]" \
  "-target=aws_apigatewayv2_integration.lambdas[\"simulations-results\"]" \
  "-target=aws_lambda_permission.permissions[\"simulations-handler-0\"]" \
  "-target=aws_lambda_permission.permissions[\"simulations-results-0\"]" \
  -target=aws_apigatewayv2_stage.main \
  "-target=aws_lambda_event_source_mapping.mappings[\"simulations-engine-0\"]" \
  -target=aws_s3_bucket.frontend \
  -target=aws_s3_bucket_versioning.frontend \
  -target=aws_s3_bucket_server_side_encryption_configuration.frontend \
  -target=aws_s3_bucket_ownership_controls.frontend \
  -target=aws_s3_bucket_public_access_block.frontend \
  -target=aws_s3_bucket_website_configuration.frontend

echo ""
echo "======================================================================"
echo "¡Destrucción MINIMA completada con éxito!"
echo "======================================================================"
