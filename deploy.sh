#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/terraform"

# --- 1. Validar variables de entorno ---
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

# --- 2. Instalar dependencias de Lambdas ---
echo "==> Instalando dependencias de todas las lambdas Node.js"
bash "${SCRIPT_DIR}/scripts/install-lambdas.sh"

# --- 3. Terraform init + apply ---
echo "==> Terraform init"
cd "${TF_DIR}"
terraform init -reconfigure "${TF_INIT_ARGS[@]}"

echo "==> Terraform apply"
terraform apply -auto-approve

# --- 4. Leer outputs de Terraform ---
BUCKET_NAME=$(terraform output -raw bucket_name)

echo ""
echo "======================================================================"
echo "¡Despliegue completado con éxito!"
echo "URL del sistema: http://${BUCKET_NAME}.s3-website-us-east-1.amazonaws.com"
echo "======================================================================"
