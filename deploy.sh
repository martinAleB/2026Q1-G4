#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/terraform"

# --- Argumentos del backend ---
if [ -z "$TF_STATE_BUCKET" ] || [ -z "$TF_LOCK_TABLE" ]; then
  echo "Faltan variables de entorno:"
  echo "  export TF_STATE_BUCKET=<nombre-del-bucket>"
  echo "  export TF_LOCK_TABLE=<nombre-de-la-tabla>"
  exit 1
fi

TF_INIT_ARGS=(
  -backend-config="bucket=${TF_STATE_BUCKET}"
  -backend-config="key=terraform.tfstate"
  -backend-config="region=us-east-1"
  -backend-config="dynamodb_table=${TF_LOCK_TABLE}"
)

# --- Terraform init ---
echo "==> Terraform init"
cd "${TF_DIR}"
terraform init -reconfigure "${TF_INIT_ARGS[@]}"

# --- Crear ECR ---
echo "==> Terraform apply (ECR)"
terraform apply -auto-approve -target=aws_ecr_repository.flyway

# --- Build y push imagen Flyway ---
echo "==> Build y push imagen Flyway"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/cloud-presti-flyway"

aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin "${ECR_URL}"

cd "${SCRIPT_DIR}"
docker build -t "${ECR_URL}:latest" db/
docker push "${ECR_URL}:latest"

# --- Apply completo ---
echo "==> Terraform apply (completo)"
cd "${TF_DIR}"
terraform apply -auto-approve

echo ""
echo "Deploy completado."
