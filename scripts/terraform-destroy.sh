#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/../terraform"
ROOT_DIR="${SCRIPT_DIR}/.."

mkdir -p "${ROOT_DIR}/backend/simulations/engine-dist"

cd "${TF_DIR}"
terraform destroy -auto-approve -var="bucket_name=${TF_FRONTEND_BUCKET_NAME}"
