#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/../terraform"

cd "${TF_DIR}"
BUCKET_NAME=$(terraform output -raw bucket_name)

echo ""
echo "======================================================================"
echo "¡Despliegue completado con éxito!"
echo "URL del sistema: http://${BUCKET_NAME}.s3-website-us-east-1.amazonaws.com"
echo "======================================================================"
