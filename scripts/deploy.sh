#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/env.sh"

bash "${SCRIPT_DIR}/install-lambdas.sh"
bash "${SCRIPT_DIR}/terraform-init.sh"
bash "${SCRIPT_DIR}/terraform-apply.sh"
bash "${SCRIPT_DIR}/migrate.sh" up

bash "${SCRIPT_DIR}/terraform-output.sh"
