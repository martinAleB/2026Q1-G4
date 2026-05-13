#!/bin/bash

echo "Configurando entorno frontend..."

# Vamos al directorio de terraform para obtener el output
cd ../terraform || exit 1

# Intentamos obtener la URL de la API
API_URL=$(terraform output -raw simulations_api_endpoint 2>/dev/null)

if [ $? -ne 0 ] || [ -z "$API_URL" ]; then
  echo "Error: No se pudo obtener simulations_api_endpoint de Terraform."
  echo "Revisá que tus credenciales de AWS no hayan expirado y que Terraform se haya aplicado correctamente."
  exit 1
fi

# Volvemos al frontend para escribir el archivo
cd ../frontend || exit 1

echo "VITE_SIMULATIONS_API_URL=$API_URL" > .env.local
echo ".env.local actualizado exitosamente."
