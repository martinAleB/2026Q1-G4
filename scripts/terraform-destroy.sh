#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TF_DIR="${SCRIPT_DIR}/../terraform"
ROOT_DIR="${SCRIPT_DIR}/.."

# The data source data.archive_file.lambdas["simulations-engine"] zips
# backend/simulations/engine-dist/, which is gitignored and may not exist
# on a fresh checkout. Create it as an empty directory so the refresh
# during destroy succeeds without having to run the expensive uv-based
# build (we are about to destroy the Lambda anyway, the contents of the
# zip are irrelevant).
mkdir -p "${ROOT_DIR}/backend/simulations/engine-dist"

cd "${TF_DIR}"
terraform destroy -auto-approve -var="bucket_name=${TF_FRONTEND_BUCKET_NAME}"
