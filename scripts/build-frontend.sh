#!/bin/bash
set -e

echo "Building frontend project..."

COGNITO_DOMAIN="${1}"
CLIENT_ID="${2}"
API_GW_ENDPOINT="${3}"
SIMULATIONS_API_ENDPOINT="${4}"
FRONTEND_DIR="${5:-../frontend}"
BUCKET_NAME="${6}"

if [ ! -d "$FRONTEND_DIR" ]; then
    echo "Error: Frontend directory not found at $FRONTEND_DIR"
    exit 1
fi

cd "$FRONTEND_DIR"

echo "Creating .env.production..."
cat > .env.production << EOF
VITE_COGNITO_DOMAIN=https://${COGNITO_DOMAIN}.auth.us-east-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=${CLIENT_ID}
VITE_API_GATEWAY_CALLBACK_URL=${API_GW_ENDPOINT}/callback
VITE_SIMULATIONS_API_URL=${SIMULATIONS_API_ENDPOINT}
EOF

echo "Installing dependencies..."
npm ci

echo "Building frontend..."
npm run build

if [ -n "$BUCKET_NAME" ]; then
    echo "Uploading to S3 bucket: $BUCKET_NAME..."
    aws s3 sync dist/ "s3://$BUCKET_NAME" --delete
    echo "Upload complete."
else
    echo "Warning: BUCKET_NAME not provided, skipping S3 upload."
fi

echo "Frontend build complete."
