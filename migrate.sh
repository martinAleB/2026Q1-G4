#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Build Lambda de migraciones ---
echo "==> Instalando dependencias Node.js"
cd "${SCRIPT_DIR}/db"
npm install --omit=dev
mkdir -p dist

# --- Crear ZIP ---
echo "==> Creando ZIP"
zip -r dist/migrations.zip . --exclude "dist/*" > /dev/null

# --- Actualizar Lambda ---
echo "==> Actualizando Lambda"
aws lambda update-function-code \
  --function-name cloud-presti-db-migrations \
  --zip-file "fileb://${SCRIPT_DIR}/db/dist/migrations.zip" \
  --region us-east-1 > /dev/null

aws lambda wait function-updated \
  --function-name cloud-presti-db-migrations \
  --region us-east-1

# --- Invocar Lambda ---
echo "==> Corriendo migraciones"
aws lambda invoke \
  --function-name cloud-presti-db-migrations \
  --log-type Tail \
  --region us-east-1 \
  --cli-read-timeout 0 \
  --query 'LogResult' \
  --output text \
  /tmp/migrate-response.json | base64 -d

echo ""
cat /tmp/migrate-response.json

if grep -q '"errorType"' /tmp/migrate-response.json; then
  echo "ERROR: Las migraciones fallaron."
  exit 1
fi

echo "Migraciones completadas."
