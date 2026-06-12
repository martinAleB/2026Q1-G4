#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/env.sh"

ACTION=${1:-up}

echo "==> Corriendo migraciones (${ACTION}) para el stack ${STACK_NAME}"
# Limpiamos el archivo temporal antes por si existiera
rm -f /tmp/migrate-response.json

# Invocamos la Lambda
aws lambda invoke \
  --function-name "${STACK_NAME}-db-migrations" \
  --log-type Tail \
  --region "${AWS_DEFAULT_REGION}" \
  --cli-read-timeout 0 \
  --cli-binary-format raw-in-base64-out \
  --payload "{\"action\": \"${ACTION}\"}" \
  --query 'LogResult' \
  --output text \
  /tmp/migrate-response.json | (base64 -d 2>/dev/null || base64 -D)

echo ""
echo "=== Output de la invocación ==="
cat /tmp/migrate-response.json
echo ""

if grep -q '"errorType"' /tmp/migrate-response.json || grep -q '"errorMessage"' /tmp/migrate-response.json; then
  echo "ERROR: Las migraciones fallaron."
  exit 1
fi

echo "Migraciones completadas exitosamente."
