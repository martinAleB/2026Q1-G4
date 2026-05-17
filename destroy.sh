#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- 1. Validar variables de entorno ---
if [ -z "$TF_STATE_BUCKET" ] || [ -z "$TF_LOCK_TABLE" ] || [ -z "$TF_FRONTEND_BUCKET_NAME" ]; then
  echo "Faltan variables de entorno indispensables:"
  echo "  export TF_STATE_BUCKET=<nombre-del-bucket-estado>"
  echo "  export TF_LOCK_TABLE=<nombre-de-la-tabla-lock>"
  echo "  export TF_FRONTEND_BUCKET_NAME=<nombre-del-bucket-frontend>"
  exit 1
fi

# --- 2. Confirmación manual ---
read -p "Escribí 'destroy' para confirmar la destrucción TOTAL de la infraestructura: " CONFIRM
if [ "$CONFIRM" != "destroy" ]; then
  echo "Cancelado."
  exit 1
fi

bash "${SCRIPT_DIR}/scripts/terraform-init.sh"
bash "${SCRIPT_DIR}/scripts/terraform-destroy.sh"

# --- 3. Limpieza local ---
echo "==> Limpiando archivos temporales locales"
rm -rf "${SCRIPT_DIR}/frontend/dist"

echo ""
echo "======================================================================"
echo "¡Infraestructura destruida con éxito!"
echo "Nota: El bucket de estado y la tabla de lock permanecen intactos."
echo "Para borrarlos, ejecutá: scripts/destroy-bootstrap.sh"
echo "======================================================================"
