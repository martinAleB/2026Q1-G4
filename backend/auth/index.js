const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({});

// Cached at module scope so warm invocations reuse the same secret without hitting Secrets Manager again.
let cachedClientSecret = null;

async function getClientSecret() {
    if (cachedClientSecret) return cachedClientSecret;

    const secretId = process.env.COGNITO_CLIENT_SECRET_ID;
    if (!secretId) throw new Error("COGNITO_CLIENT_SECRET_ID env var is not set");

    const { SecretString } = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: secretId })
    );
    cachedClientSecret = SecretString;
    return cachedClientSecret;
}

exports.handler = async (event) => {
    const clientId = process.env.COGNITO_CLIENT_ID;
    const cognitoDomain = process.env.COGNITO_DOMAIN;
    const frontendUrl = process.env.FRONTEND_URL;
    // El callback URL se inyecta como env var desde Terraform en lugar de
    // reconstruirlo del Host header del request: un proxy podría mandar un
    // Host forjado, y aunque Cognito valida redirect_uri contra los
    // callback_urls registrados (lo cual ya bloquea el ataque), apuntar a
    // un valor fijo de configuración es menos frágil.
    const callbackUrl = process.env.CALLBACK_URL;

    const code = event.queryStringParameters?.code;

    if (!code) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Falta el parámetro 'code' en la URL" }),
        };
    }

    if (!callbackUrl) {
        console.error("CALLBACK_URL env var no está configurada");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error interno del servidor" }),
        };
    }

    try {
        const clientSecret = await getClientSecret();
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const authHeader = `Basic ${credentials}`;
        const tokenEndpoint = `${cognitoDomain}/oauth2/token`;
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            code: code,
            redirect_uri: callbackUrl
        });

        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': authHeader
            },
            body: params.toString()
        });

        if (!response.ok) {
            const errorData = await response.text();
            console.error("Error from Cognito:", errorData);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: "Error al intercambiar el código", details: errorData })
            };
        }

        const tokens = await response.json();
        const redirectUrl = `${frontendUrl}/#access_token=${tokens.access_token}&id_token=${tokens.id_token}`;

        return {
            statusCode: 302,
            headers: {
                Location: redirectUrl,
            }
        };

    } catch (error) {
        console.error("Internal Lambda error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error interno del servidor", message: error.message }),
        };
    }
};
