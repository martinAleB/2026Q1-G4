#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"

START_TIME=$(date +%s)

process_lambda() {
  local pkg="$1"
  local lambda_dir
  lambda_dir="$(dirname "$pkg")"
  local rel_path="${lambda_dir#${BACKEND_DIR}/}"

  if [ -d "${lambda_dir}/node_modules" ] && [ "${lambda_dir}/node_modules" -nt "${lambda_dir}/package-lock.json" ]; then
    echo "[skip]  ${rel_path}"
    return 0
  fi

  local start
  start=$(date +%s)
  echo "[start] ${rel_path}"
  (cd "$lambda_dir" && npm ci --omit=dev --silent)
  echo "[done]  ${rel_path} ($(($(date +%s) - start))s)"
}
export -f process_lambda
export BACKEND_DIR

TOTAL=$(find "$BACKEND_DIR" -name node_modules -prune -o -name package.json -print | wc -l | tr -d ' ')
echo "==> Instalando dependencias de ${TOTAL} Lambdas (paralelo, 4 a la vez)"

find "$BACKEND_DIR" -name node_modules -prune -o -name package.json -print | \
  xargs -n 1 -P 4 -I {} bash -c 'process_lambda "$@"' _ {}

echo ""
echo "==> Copiando módulo compartido (shared/enqueue.js)"
for lambda_dir in \
  "${BACKEND_DIR}/simulations/handler" \
  "${BACKEND_DIR}/b2b-evaluations"; do
  mkdir -p "${lambda_dir}/shared"
  cp "${BACKEND_DIR}/shared/enqueue.js" "${lambda_dir}/shared/enqueue.js"
  echo "    → ${lambda_dir#${BACKEND_DIR}/}/shared/enqueue.js"
done

echo ""
echo "==> Building simulations engine"
engine_start=$(date +%s)
bash "${SCRIPT_DIR}/build-engine.sh"
echo "    OK (engine, $(($(date +%s) - engine_start))s)"

echo ""
echo "Dependencias instaladas en todas las lambdas ($(($(date +%s) - START_TIME))s total)"
