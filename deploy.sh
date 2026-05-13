#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/terraform"

# --- Argumentos del backend ---
if [ -z "$TF_STATE_BUCKET" ] || [ -z "$TF_LOCK_TABLE" ]; then
  echo "Faltan variables de entorno:"
  echo "  export TF_STATE_BUCKET=<nombre-del-bucket>"
  echo "  export TF_LOCK_TABLE=<nombre-de-la-tabla>"
# --- 1. Empaquetar motor ML (Lambdas Python) ---
echo "==> Generando paquete de la Lambda de Simulaciones"
bash "${SCRIPT_DIR}/scripts/build_engine.sh"

# --- 2. Validar variables de entorno ---
if [ -z "$TF_STATE_BUCKET" ] || [ -z "$TF_LOCK_TABLE" ] || [ -z "$TF_FRONTEND_BUCKET_NAME" ]; then
  echo "Faltan variables de entorno indispensables:"
  echo "  export TF_STATE_BUCKET=<nombre-del-bucket-estado>"
  echo "  export TF_LOCK_TABLE=<nombre-de-la-tabla-lock>"
  echo "  export TF_FRONTEND_BUCKET_NAME=<nombre-del-bucket-frontend>"
  echo ""
  echo "Si no has creado el bucket de estado, ve a terraform/bootstrap y corre terraform apply primero."
  exit 1
fi

TF_INIT_ARGS=(
  -backend-config="bucket=${TF_STATE_BUCKET}"
  -backend-config="key=terraform.tfstate"
  -backend-config="region=us-east-1"
  -backend-config="dynamodb_table=${TF_LOCK_TABLE}"
)

# --- 3. Preparar Lambda de migraciones ---
echo "==> Instalando dependencias de base de datos"
cd "${SCRIPT_DIR}/db"
npm install --omit=dev
mkdir -p dist

# --- 4. Terraform init + apply ---
echo "==> Terraform init"
cd "${TF_DIR}"
terraform init -reconfigure "${TF_INIT_ARGS[@]}"

echo "==> Terraform apply"
terraform apply -auto-approve

# --- 5. Leer outputs de Terraform ---
COGNITO_DOMAIN=$(terraform output -raw auth_cognito_domain)
CLIENT_ID=$(terraform output -raw auth_client_id)
API_GW_ENDPOINT=$(terraform output -raw auth_api_gateway_endpoint)
BUCKET_NAME=$(terraform output -raw bucket_name)
SIMULATIONS_API_ENDPOINT=$(terraform output -raw simulations_api_endpoint)

# --- 6. Build frontend ---
echo "==> Construyendo frontend"
cd "${SCRIPT_DIR}/frontend"

cat > .env.production << EOF
VITE_COGNITO_DOMAIN=https://${COGNITO_DOMAIN}.auth.us-east-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=${CLIENT_ID}
VITE_API_GATEWAY_CALLBACK_URL=${API_GW_ENDPOINT}/callback
VITE_SIMULATIONS_API_URL=${SIMULATIONS_API_ENDPOINT}
EOF

npm ci
npm run build

# --- 7. Subir al bucket S3 ---
echo "==> Subiendo frontend a S3"
aws s3 sync dist/ "s3://${BUCKET_NAME}" --delete --acl public-read

# --- 8. Ejecutar Migraciones de DB ---
echo "==> Ejecutando migraciones en la base de datos"
bash "${SCRIPT_DIR}/scripts/migrate.sh"

echo ""
echo "======================================================================"
echo "¡Despliegue completado con éxito!"
echo "URL del sistema: http://${BUCKET_NAME}.s3-website-us-east-1.amazonaws.com"
echo "======================================================================"
