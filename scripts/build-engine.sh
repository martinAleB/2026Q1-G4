#!/bin/bash
set -euo pipefail

START_TIME=$(date +%s)
echo "Iniciando empaquetado de la Lambda de Simulaciones..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

BUILD_DIR="backend/simulations/engine-dist"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

echo "[$(date +%T)] Instalando dependencias (manylinux)... (~30-90s, descarga numpy + LiteRT)"
step_start=$(date +%s)
uv pip install \
    --python-platform x86_64-manylinux_2_28 \
    --target "${BUILD_DIR}" \
    --python-version 3.12 \
    --only-binary=:all: \
    --no-cache \
    -r "${ROOT_DIR}/backend/simulations/engine/requirements.txt"
echo "    OK ($(($(date +%s) - step_start))s)"

echo "[$(date +%T)] Copiando código fuente..."
cp -r backend/simulations/engine/* "${BUILD_DIR}/"

echo "[$(date +%T)] Ejecutando limpieza para bajar de 50MB..."

find "${BUILD_DIR}" -type d -name "tests"      -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "test"       -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
# find "${BUILD_DIR}" -type d -name "*.dist-info" -exec rm -rf {} + 2>/dev/null || true
# find "${BUILD_DIR}" -type d -name "*.egg-info"  -exec rm -rf {} + 2>/dev/null || true

find "${BUILD_DIR}/numpy" -name "*cpython-311*" -delete 2>/dev/null || true
find "${BUILD_DIR}/numpy" -name "*cpython-310*" -delete 2>/dev/null || true

rm -rf "${BUILD_DIR}/ai_edge_litert/libLiteRtWebGpuAccelerator.so" 2>/dev/null || true
rm -rf "${BUILD_DIR}/ai_edge_litert/vendors" 2>/dev/null || true
rm -rf "${BUILD_DIR}/ai_edge_litert/tools" 2>/dev/null || true

rm -rf "${BUILD_DIR}/numpy/doc" 2>/dev/null || true
rm -rf "${BUILD_DIR}/numpy/_core/include" 2>/dev/null || true
rm -rf "${BUILD_DIR}/numpy/_core/lib" 2>/dev/null || true

find "${BUILD_DIR}" -name "*.so" -exec strip --strip-unneeded {} + 2>/dev/null || true

SIZE=$(du -sh "${BUILD_DIR}" | cut -f1)
ELAPSED=$(($(date +%s) - START_TIME))
echo "======================================================================"
echo "¡Build exitoso! Directorio generado: ${BUILD_DIR} (Tamaño: ${SIZE}, ${ELAPSED}s)"
echo "======================================================================"
