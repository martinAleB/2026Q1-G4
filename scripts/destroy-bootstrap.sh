#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/env.sh"

BOOTSTRAP_DIR="${SCRIPT_DIR}/../terraform-bootstrap"
cd "${BOOTSTRAP_DIR}"

echo "==> Terraform destroy (bootstrap)"
terraform destroy -auto-approve \
  -var="state_bucket_name=${TF_STATE_BUCKET}" \
  -var="lock_table_name=${TF_LOCK_TABLE}"

echo ""
echo "Bootstrap destruido. Bucket de estado y tabla de lock eliminados."
