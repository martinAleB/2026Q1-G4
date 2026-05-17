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
  echo "Si no has creado el bucket de estado, ve a terraform/bootstrap y corre terraform apply primero."
  exit 1
fi

bash "${SCRIPT_DIR}/scripts/install-lambdas.sh"
bash "${SCRIPT_DIR}/scripts/terraform-init.sh"
bash "${SCRIPT_DIR}/scripts/terraform-apply.sh"
bash "${SCRIPT_DIR}/scripts/terraform-output.sh"
