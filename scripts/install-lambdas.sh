#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"

while IFS= read -r pkg; do
  lambda_dir="$(dirname "$pkg")"
  rel_path="${lambda_dir#${BACKEND_DIR}/}"
  echo "==> npm install ${rel_path}"
  cd "$lambda_dir"
  npm ci --omit=dev --silent
  cd - > /dev/null
done < <(find "$BACKEND_DIR" -name "package.json" -not -path "*/node_modules/*")

echo "==> Building simulations engine"
bash "${SCRIPT_DIR}/build-engine.sh"

echo ""
echo "Dependencias instaladas en todas las lambdas"
