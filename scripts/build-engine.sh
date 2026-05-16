#!/bin/bash
set -e

echo "Iniciando empaquetado de la Lambda de Simulaciones..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

# 1. Crear directorio de build limpio
BUILD_DIR="backend/simulations/engine-dist"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# 2. Instalar dependencias para Amazon Linux (manylinux) usando uv
echo "Instalando dependencias (manylinux)..."
uv pip install \
    --python-platform x86_64-manylinux_2_28 \
    --target "${BUILD_DIR}" \
    --python-version 3.12 \
    --only-binary=:all: \
    --no-cache \
    -r "${ROOT_DIR}/backend/simulations/engine/requirements.txt"

# 3. Copiar el código de la Lambda y los artefactos
echo "Copiando código fuente y modelo..."
cp -r backend/simulations/engine/* "${BUILD_DIR}/"

echo "Copiando artefactos del modelo..."
mkdir -p "${BUILD_DIR}/artifacts"
cp engine/artifacts/modelo_crediticio.tflite "${BUILD_DIR}/artifacts/"
cp engine/artifacts/scaler_params.json "${BUILD_DIR}/artifacts/"
cp engine/artifacts/feature_columns.json "${BUILD_DIR}/artifacts/"
cp engine/artifacts/feature_fill_values.json "${BUILD_DIR}/artifacts/"

# 4. Limpieza para reducir tamaño
echo "Ejecutando limpieza para bajar de 50MB..."

find "${BUILD_DIR}" -type d -name "tests"      -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "test"       -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "*.dist-info" -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "*.egg-info"  -exec rm -rf {} + 2>/dev/null || true

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
echo "======================================================================"
echo "¡Build exitoso! Directorio generado: ${BUILD_DIR} (Tamaño: ${SIZE})"
echo "======================================================================"
