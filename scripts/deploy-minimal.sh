#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "${SCRIPT_DIR}/scripts/env.sh"

TF_DIR="${SCRIPT_DIR}/terraform"

echo "======================================================================"
echo "Iniciando despliegue MÍNIMO (Solo API y Frontend)"
echo "======================================================================"

TF_INIT_ARGS=(
  -backend-config="bucket=${TF_STATE_BUCKET}"
  -backend-config="key=terraform.tfstate"
  -backend-config="region=us-east-1"
  -backend-config="dynamodb_table=${TF_LOCK_TABLE}"
)

# --- 2. Preparar Código de Lambdas ---
echo "==> Generando paquete de la Lambda de Simulaciones"
bash "${SCRIPT_DIR}/scripts/build-engine.sh"

# --- 3. Terraform init + apply (TARGENTEADO) ---
echo "==> Inicializando Terraform"
cd "${TF_DIR}"
terraform init -reconfigure "${TF_INIT_ARGS[@]}"

echo "==> Ejecutando Terraform Apply (Targeted)"
terraform apply -auto-approve \
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

# --- 4. Leer outputs de Terraform ---
echo "==> Capturando Outputs de la infraestructura"
BUCKET_NAME=$(terraform output -raw bucket_name)
API_ENDPOINT=$(terraform output -raw api_endpoint)

if [ -z "$BUCKET_NAME" ] || [ -z "$API_ENDPOINT" ]; then
    echo "Error: No se pudieron obtener los outputs necesarios de Terraform. Asegúrate de que los targets incluyan lo necesario para generar los outputs."
    exit 1
fi

# --- 5. Build frontend ---
echo "==> Configurando y construyendo el frontend"
cd "${SCRIPT_DIR}/frontend"

# Creamos el .env de produccion estrictamente con lo necesario
cat > .env.production << EOF
VITE_SIMULATIONS_API_URL=${API_ENDPOINT}
EOF

npm ci
npm run build

# --- 6. Subir al bucket S3 ---
echo "==> Subiendo frontend a S3 (${BUCKET_NAME})"
aws s3 sync dist/ "s3://${BUCKET_NAME}" --delete

echo ""
echo "======================================================================"
echo "¡Despliegue MINIMO completado con éxito!"
echo "URL del Frontend: http://${BUCKET_NAME}.s3-website-us-east-1.amazonaws.com"
echo "URL de la API: ${API_ENDPOINT}"
echo "======================================================================"
