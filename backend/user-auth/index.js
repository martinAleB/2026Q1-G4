exports.handler = async (event) => {
    const clientId = process.env.COGNITO_CLIENT_ID;
    const clientSecret = process.env.COGNITO_CLIENT_SECRET;
    const cognitoDomain = process.env.COGNITO_DOMAIN;
    const frontendUrl = process.env.FRONTEND_URL;
    const apiGatewayUrl = `https://${event.headers.host}${event.requestContext.http.path}`;

    const code = event.queryStringParameters?.code;

    if (!code) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Falta el parámetro 'code' en la URL" }),
        };
    }

    try {
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        const authHeader = `Basic ${credentials}`;
        const tokenEndpoint = `${cognitoDomain}/oauth2/token`;
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            code: code,
            redirect_uri: apiGatewayUrl
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
            console.error("Error desde Cognito:", errorData);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: "Error al intercambiar el código", details: errorData })
            };
        }

        const tokens = await response.json();
        
        const redirectUrl = `${frontendUrl}#access_token=${tokens.access_token}&id_token=${tokens.id_token}`;

        return {
            statusCode: 302,
            headers: {
                Location: redirectUrl,
            }
        };

    } catch (error) {
        console.error("Error interno en la Lambda:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Error interno del servidor" }),
        };
    }
};
