#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/env.sh"

# --- Confirmación manual ---
read -p "Escribí 'destroy' para confirmar la destrucción TOTAL de la infraestructura: " CONFIRM
if [ "$CONFIRM" != "destroy" ]; then
  echo "Cancelado."
  exit 1
fi

bash "${SCRIPT_DIR}/terraform-init.sh"
bash "${SCRIPT_DIR}/terraform-destroy.sh"

# --- Limpieza local ---
echo "==> Limpiando archivos temporales locales"
rm -rf "${SCRIPT_DIR}/../frontend/dist"

echo ""
echo "======================================================================"
echo "¡Infraestructura destruida con éxito!"
echo "Nota: El bucket de estado y la tabla de lock permanecen intactos."
echo "Para borrarlos, ejecutá: scripts/destroy-bootstrap.sh"
echo "======================================================================"
