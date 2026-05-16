#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/terraform"

# --- 1. Validar variables de entorno ---
if [ -z "$TF_STATE_BUCKET" ] || [ -z "$TF_LOCK_TABLE" ]; then
  echo "Faltan variables de entorno para identificar el estado remoto:"
  echo "  export TF_STATE_BUCKET=<nombre-del-bucket-estado>"
  echo "  export TF_LOCK_TABLE=<nombre-de-la-tabla-lock>"
  exit 1
fi

read -p "Escribí 'destroy' para confirmar la destrucción TOTAL de la infraestructura: " CONFIRM
if [ "$CONFIRM" != "destroy" ]; then
  echo "Cancelado."
  exit 1
fi

# --- 2. Terraform destroy ---
TF_INIT_ARGS=(
  -backend-config="bucket=${TF_STATE_BUCKET}"
  -backend-config="key=terraform.tfstate"
  -backend-config="region=us-east-1"
  -backend-config="dynamodb_table=${TF_LOCK_TABLE}"
)

echo "==> Inicializando Terraform"
cd "${TF_DIR}"
terraform init -reconfigure "${TF_INIT_ARGS[@]}"

echo "==> Ejecutando Terraform DESTROY"
terraform destroy -auto-approve -var="bucket_name=${TF_FRONTEND_BUCKET_NAME}"

# --- 3. Limpieza de archivos locales ---
echo "==> Limpiando archivos temporales locales"
cd "${SCRIPT_DIR}"
rm -f simulations_engine.zip
rm -rf db/dist
rm -rf frontend/dist

echo ""
echo "======================================================================"
echo "¡Infraestructura destruida con éxito!"
echo "Nota: El bucket de estado y la tabla de lock permanecen intactos."
echo "Para borrarlos, ve a terraform/bootstrap y corre terraform destroy."
echo "======================================================================"
