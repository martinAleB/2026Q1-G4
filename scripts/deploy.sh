#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- 1. Validar variables de entorno ---
if [ -z "$TF_STATE_BUCKET" ] || [ -z "$TF_LOCK_TABLE" ] || [ -z "$TF_FRONTEND_BUCKET_NAME" ]; then
  echo "Faltan variables de entorno indispensables:"
  echo "  export TF_STATE_BUCKET=<nombre-del-bucket-estado>"
  echo "  export TF_LOCK_TABLE=<nombre-de-la-tabla-lock>"
  echo "  export TF_FRONTEND_BUCKET_NAME=<nombre-del-bucket-frontend>"
  echo ""
  echo "Si no has creado el bucket de estado, corré primero: scripts/bootstrap.sh"
  exit 1
fi

bash "${SCRIPT_DIR}/install-lambdas.sh"
bash "${SCRIPT_DIR}/terraform-init.sh"
bash "${SCRIPT_DIR}/terraform-apply.sh"

# --- 2. Build y deploy del frontend a S3 ---
TF_DIR="${SCRIPT_DIR}/../terraform"
FRONTEND_DIR="${SCRIPT_DIR}/../frontend"

COGNITO_DOMAIN=$(terraform -chdir="${TF_DIR}" output -raw auth_cognito_domain)
CLIENT_ID=$(terraform -chdir="${TF_DIR}" output -raw auth_client_id)
API_ENDPOINT=$(terraform -chdir="${TF_DIR}" output -raw api_endpoint)
FRONTEND_BUCKET=$(terraform -chdir="${TF_DIR}" output -raw bucket_name)

bash "${SCRIPT_DIR}/build-frontend.sh" \
  "${COGNITO_DOMAIN}" \
  "${CLIENT_ID}" \
  "${API_ENDPOINT}" \
  "${FRONTEND_DIR}" \
  "${FRONTEND_BUCKET}"

bash "${SCRIPT_DIR}/terraform-output.sh"
