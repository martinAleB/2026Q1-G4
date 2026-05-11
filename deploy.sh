#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/terraform"

# --- Argumentos del backend ---
if [ -z "$TF_STATE_BUCKET" ] || [ -z "$TF_LOCK_TABLE" ] || [ -z "$TF_FRONTEND_BUCKET_NAME" ]; then
  echo "Faltan variables de entorno:"
  echo "  export TF_STATE_BUCKET=<nombre-del-bucket>"
  echo "  export TF_LOCK_TABLE=<nombre-de-la-tabla>"
  echo "  export TF_FRONTEND_BUCKET_NAME=<nombre-del-bucket-frontend>"
  exit 1
fi

TF_INIT_ARGS=(
  -backend-config="bucket=${TF_STATE_BUCKET}"
  -backend-config="key=terraform.tfstate"
  -backend-config="region=us-east-1"
  -backend-config="dynamodb_table=${TF_LOCK_TABLE}"
)

# --- Build Lambda de migraciones ---
echo "==> Instalando dependencias Node.js"
cd "${SCRIPT_DIR}/db"
npm install --omit=dev
mkdir -p dist

# --- Terraform init + apply ---
echo "==> Terraform init"
cd "${TF_DIR}"
terraform init -reconfigure "${TF_INIT_ARGS[@]}"

echo "==> Terraform apply"
terraform apply -auto-approve -var="bucket_name=${TF_FRONTEND_BUCKET_NAME}"

# --- Leer outputs de Terraform ---
COGNITO_DOMAIN=$(terraform output -raw auth_cognito_domain)
CLIENT_ID=$(terraform output -raw auth_client_id)
API_GW_ENDPOINT=$(terraform output -raw auth_api_gateway_endpoint)
BUCKET_NAME=$(terraform output -raw bucket_name)

# --- Build frontend ---
echo "==> Build frontend"
cd "${SCRIPT_DIR}/frontend"

cat > .env.local << EOF
VITE_COGNITO_DOMAIN=https://${COGNITO_DOMAIN}.auth.us-east-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=${CLIENT_ID}
VITE_API_GATEWAY_CALLBACK_URL=${API_GW_ENDPOINT}/callback
EOF

npm ci
npm run build

# --- Subir al bucket S3 ---
echo "==> Subiendo frontend a S3"
aws s3 sync dist/ "s3://${BUCKET_NAME}" --delete --acl public-read

echo ""
echo "Deploy completado."
