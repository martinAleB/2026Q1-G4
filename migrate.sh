#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- Build y push imagen Flyway ---
echo "==> Build y push imagen Flyway"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/cloud-presti-flyway"

aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "${ECR_URL}"

cd "${SCRIPT_DIR}"
docker build -t "${ECR_URL}:latest" db/
docker push "${ECR_URL}:latest"

# --- Actualizar Lambda con la nueva imagen ---
echo "==> Actualizando Lambda"
aws lambda update-function-code \
  --function-name cloud-presti-flyway \
  --image-uri "${ECR_URL}:latest" \
  --region us-east-1 > /dev/null

aws lambda wait function-updated \
  --function-name cloud-presti-flyway \
  --region us-east-1

# --- Invocar Lambda ---
echo "==> Corriendo migraciones"
aws lambda invoke \
  --function-name cloud-presti-flyway \
  --log-type Tail \
  --region us-east-1 \
  --cli-read-timeout 0 \
  --query 'LogResult' \
  --output text \
  /tmp/migrate-response.json | base64 -d

echo ""
cat /tmp/migrate-response.json

if grep -q '"FunctionError"' /tmp/migrate-response.json; then
  echo "ERROR: Las migraciones fallaron."
  exit 1
fi

echo "Migraciones completadas."
