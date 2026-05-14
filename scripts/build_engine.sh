#!/bin/bash
set -e

echo "Iniciando empaquetado de la Lambda de Simulaciones..."

# Nos aseguramos de estar en la raíz del proyecto (un nivel arriba de scripts/)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

# 1. Crear directorio temporal limpio
BUILD_DIR="build_engine"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# 2. Instalar dependencias para Amazon Linux (manylinux) usando uv
echo "Instalando dependencias (manylinux_2_27_x86_64)..."
uv pip install \
    --python-platform x86_64-manylinux_2_28 \
    --target "${BUILD_DIR}" \
    --python-version 3.12 \
    --only-binary=:all: \
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

# 4. Limpieza moderada para reducir el tamaño del ZIP
echo "Limpiando archivos innecesarios para achicar el paquete..."
find "${BUILD_DIR}" -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find "${BUILD_DIR}" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
# No eliminamos .dist-info por precaución con librerías compiladas
# Eliminar binarios y estáticos que no se usan en ejecución
rm -rf "${BUILD_DIR}/numpy/tests" 2>/dev/null || true

# 5. Zipear todo
ZIP_NAME="simulations_engine.zip"
echo "Comprimiendo en ${ZIP_NAME}..."
cd "${BUILD_DIR}"
zip -q -r9 "../${ZIP_NAME}" .
cd ..

# 6. Limpiar la carpeta temporal
rm -rf "${BUILD_DIR}"

# Mostrar tamaño final
SIZE=$(du -h "${ZIP_NAME}" | cut -f1)
echo "======================================================================"
echo "¡Empaquetado exitoso! Archivo generado: ${ZIP_NAME} (Tamaño: ${SIZE})"
echo "======================================================================"
echo "Instrucciones: Ahora puedes correr 'terraform apply' sin problemas."
