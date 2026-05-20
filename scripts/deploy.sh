#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/env.sh"

bash "${SCRIPT_DIR}/install-lambdas.sh"
bash "${SCRIPT_DIR}/terraform-init.sh"
bash "${SCRIPT_DIR}/terraform-apply.sh"

TF_DIR="${SCRIPT_DIR}/../terraform"
FRONTEND_DIR="${SCRIPT_DIR}/../frontend"

COGNITO_DOMAIN=$(terraform -chdir="${TF_DIR}" output -raw auth_cognito_domain)
CLIENT_ID=$(terraform -chdir="${TF_DIR}" output -raw auth_client_id)
API_ENDPOINT=$(terraform -chdir="${TF_DIR}" output -raw api_endpoint)
FRONTEND_BUCKET=$(terraform -chdir="${TF_DIR}" output -raw bucket_name)

bash "${SCRIPT_DIR}/build-frontend.sh" \
  "${COGNITO_DOMAIN}" \
  "${CLIENT_ID}" \
  "${API_ENDPOINT}" \
  "${FRONTEND_DIR}" \
  "${FRONTEND_BUCKET}"

bash "${SCRIPT_DIR}/terraform-output.sh"
