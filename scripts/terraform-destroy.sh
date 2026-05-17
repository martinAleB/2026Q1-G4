#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/../terraform"

cd "${TF_DIR}"
terraform destroy -auto-approve -var="bucket_name=${TF_FRONTEND_BUCKET_NAME}"
