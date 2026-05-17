#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOTSTRAP_DIR="${SCRIPT_DIR}/../terraform-bootstrap"

if [ -z "$TF_STATE_BUCKET" ] || [ -z "$TF_LOCK_TABLE" ]; then
  echo "Faltan variables de entorno indispensables:"
  echo "  export TF_STATE_BUCKET=<nombre-del-bucket-estado>"
  echo "  export TF_LOCK_TABLE=<nombre-de-la-tabla-lock>"
  exit 1
fi

cd "${BOOTSTRAP_DIR}"

echo "==> Terraform destroy (bootstrap)"
terraform destroy -auto-approve \
  -var="state_bucket_name=${TF_STATE_BUCKET}" \
  -var="lock_table_name=${TF_LOCK_TABLE}"

echo ""
echo "Bootstrap destruido. Bucket de estado y tabla de lock eliminados."
