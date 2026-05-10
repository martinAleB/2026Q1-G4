#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/terraform"

export TF_STATE_BUCKET=cloud-presti-tf-state
export TF_LOCK_TABLE=cloud-presti-tf-lock
export TF_FRONTEND_BUCKET_NAME=cloud-presti-test-tf-frontend-bucket

read -p "Escribí 'destroy' para confirmar: " CONFIRM
if [ "$CONFIRM" != "destroy" ]; then
  echo "Cancelado."
  exit 1
fi

TF_INIT_ARGS=(
  -backend-config="bucket=${TF_STATE_BUCKET}"
  -backend-config="key=terraform.tfstate"
  -backend-config="region=us-east-1"
  -backend-config="dynamodb_table=${TF_LOCK_TABLE}"
)

# --- Vaciar bucket frontend ---
echo "==> Vaciando bucket frontend"
aws s3 rm "s3://${TF_FRONTEND_BUCKET_NAME}" --recursive 2>/dev/null \
  || echo "    Bucket no existe o ya está vacío, continuando."

# --- Vaciar repositorio ECR ---
echo "==> Vaciando repositorio ECR"
IMAGE_IDS=$(aws ecr list-images \
  --repository-name cloud-presti-flyway \
  --region us-east-1 \
  --query 'imageIds[*]' \
  --output json 2>/dev/null) || IMAGE_IDS="[]"
if [ "$IMAGE_IDS" != "[]" ]; then
  aws ecr batch-delete-image \
    --repository-name cloud-presti-flyway \
    --region us-east-1 \
    --image-ids "$IMAGE_IDS"
else
  echo "    Repositorio no existe o ya está vacío, continuando."
fi

# --- Terraform destroy ---
echo "==> Terraform destroy"
cd "${TF_DIR}"
terraform init -reconfigure "${TF_INIT_ARGS[@]}"
terraform destroy -auto-approve

echo ""
echo "Infraestructura destruida."
