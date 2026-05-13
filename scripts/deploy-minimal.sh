#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${SCRIPT_DIR}/terraform"

echo "======================================================================"
echo "Iniciando despliegue MÍNIMO (Solo API y Frontend)"
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

# --- 2. Preparar Código de Lambdas ---
echo "==> Generando paquete de la Lambda de Simulaciones"
bash "${SCRIPT_DIR}/scripts/build_engine.sh"

echo "==> Instalando dependencias de Node.js para lambdas de base de datos"
cd "${SCRIPT_DIR}/db"
npm install --omit=dev
mkdir -p dist

# --- 3. Terraform init + apply (TARGENTEADO) ---
echo "==> Inicializando Terraform"
cd "${TF_DIR}"
terraform init -reconfigure "${TF_INIT_ARGS[@]}"

echo "==> Ejecutando Terraform Apply (Targeted)"
terraform apply -auto-approve \
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

# --- 4. Leer outputs de Terraform ---
echo "==> Capturando Outputs de la infraestructura"
BUCKET_NAME=$(terraform output -raw bucket_name)
SIMULATIONS_API_ENDPOINT=$(terraform output -raw simulations_api_endpoint)

if [ -z "$BUCKET_NAME" ] || [ -z "$SIMULATIONS_API_ENDPOINT" ]; then
    echo "Error: No se pudieron obtener los outputs necesarios de Terraform. Asegúrate de que los targets incluyan lo necesario para generar los outputs."
    exit 1
fi

# --- 5. Build frontend ---
echo "==> Configurando y construyendo el frontend"
cd "${SCRIPT_DIR}/frontend"

# Creamos el .env de produccion estrictamente con lo necesario
cat > .env.production << EOF
VITE_SIMULATIONS_API_URL=${SIMULATIONS_API_ENDPOINT}
EOF

npm ci
npm run build

# --- 6. Subir al bucket S3 ---
echo "==> Subiendo frontend a S3 (${BUCKET_NAME})"
aws s3 sync dist/ "s3://${BUCKET_NAME}" --delete --acl public-read

echo ""
echo "======================================================================"
echo "¡Despliegue MINIMO completado con éxito!"
echo "URL del Frontend: http://${BUCKET_NAME}.s3-website-us-east-1.amazonaws.com"
echo "URL de la API: ${SIMULATIONS_API_ENDPOINT}"
echo "======================================================================"
