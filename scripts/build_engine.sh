#!/bin/bash
set -e

echo "Iniciando empaquetado QUIRÚRGICO de la Lambda de Simulaciones..."

# Nos aseguramos de estar en la raíz del proyecto
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

# 1. Crear directorio temporal limpio
BUILD_DIR="build_engine"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# 2. Instalar dependencias usando uv con banderas de optimización
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

# 4. LIMPIEZA QUIRÚRGICA EXTREMA
echo "Ejecutando limpieza extrema para bajar de 50MB..."

# Eliminar carpetas de metadatos y tests que ocupan mucho
find "${BUILD_DIR}" -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "test" -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "*.dist-info" -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

# Eliminar binarios de numpy para otras versiones que a veces uv descarga
find "${BUILD_DIR}/numpy" -name "*cpython-311*" -delete 2>/dev/null || true
find "${BUILD_DIR}/numpy" -name "*cpython-310*" -delete 2>/dev/null || true

# Eliminar librerías estáticas (.a) y de debug de ai-edge-litert
rm -rf "${BUILD_DIR}/ai_edge_litert/libLiteRtWebGpuAccelerator.so" 2>/dev/null || true
rm -rf "${BUILD_DIR}/ai_edge_litert/vendors" 2>/dev/null || true
rm -rf "${BUILD_DIR}/ai_edge_litert/tools" 2>/dev/null || true

# Eliminar archivos de numpy que no son esenciales para ejecución
rm -rf "${BUILD_DIR}/numpy/doc" 2>/dev/null || true
rm -rf "${BUILD_DIR}/numpy/_core/include" 2>/dev/null || true
rm -rf "${BUILD_DIR}/numpy/_core/lib" 2>/dev/null || true

# Strip de binarios .so (Elimina símbolos de debug, MUY efectivo)
find "${BUILD_DIR}" -name "*.so" -exec strip --strip-unneeded {} + 2>/dev/null || true

# 5. Zipear todo con máxima compresión (-9)
ZIP_NAME="simulations_engine.zip"
echo "Comprimiendo con compresión máxima..."
cd "${BUILD_DIR}"
zip -q -r9 "../${ZIP_NAME}" .
cd ..

# 6. Limpiar la carpeta temporal
rm -rf "${BUILD_DIR}"

# Mostrar tamaño final en bytes para precisión
SIZE_BYTES=$(ls -l "${ZIP_NAME}" | awk '{print $5}')
SIZE_MB=$(ls -lh "${ZIP_NAME}" | awk '{print $5}')
echo "======================================================================"
echo "¡Paquete optimizado! Archivo: ${ZIP_NAME}"
echo "Tamaño: ${SIZE_MB} (${SIZE_BYTES} bytes)"
echo "Límite AWS: 52428800 bytes (50 MB)"
echo "======================================================================"

if [ $SIZE_BYTES -lt 52428800 ]; then
  echo "✅ ¡LO LOGRAMOS! El paquete entra en el límite de subida directa."
else
  echo "❌ Sigue excediendo el límite. AWS S3 será necesario."
fi
