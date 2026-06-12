const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const smClient = new SecretsManagerClient({ region: 'us-east-1' });
let poolPromise;

function getPool() {
    if (!poolPromise) {
        poolPromise = (async () => {
            const { SecretString } = await smClient.send(
                new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
            );
            const { username, password } = JSON.parse(SecretString);
            return new Pool({
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT, 10),
                database: process.env.DB_NAME,
                user: username,
                password,
                ssl: { rejectUnauthorized: false },
            });
        })().catch((err) => {
            poolPromise = undefined;
            throw err;
        });
    }
    return poolPromise;
}

const headers = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
    try {
        const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
        if (!sub) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        const queryParams = event.queryStringParameters || {};
        const limit = Math.min(parseInt(queryParams.limit) || 20, 100);
        const offset = parseInt(queryParams.offset) || 0;
        const searchCuit = queryParams.cuit;

        const client = await (await getPool()).connect();
        try {
            // Verificar si las tablas existen antes de consultar
            const tableCheck = await client.query(`
                SELECT (
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'portfolio_tracking'
                    )
                ) AND (
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'portfolio_cuits'
                    )
                ) AS exists
            `);
            const tablesExist = tableCheck.rows[0].exists;

            if (!tablesExist) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ items: [], total: 0, limit, offset }),
                };
            }

            if (searchCuit) {
                const { rows } = await client.query(
                    `SELECT c.cuit, c.current_status, c.previous_status, c.trend,
                            c.last_updated, t.tracked_at
                     FROM portfolio_tracking t
                     JOIN portfolio_cuits c ON t.cuit = c.cuit
                     WHERE t.fintech_sub = $1 AND t.cuit = $2`,
                    [sub, searchCuit]
                );

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ items: rows, total: rows.length }),
                };
            }

            const countResult = await client.query(
                'SELECT COUNT(*) FROM portfolio_tracking WHERE fintech_sub = $1',
                [sub]
            );
            const total = parseInt(countResult.rows[0].count, 10);

            const { rows } = await client.query(
                `SELECT c.cuit, c.current_status, c.previous_status, c.trend,
                        c.last_updated, t.tracked_at
                 FROM portfolio_tracking t
                 JOIN portfolio_cuits c ON t.cuit = c.cuit
                 WHERE t.fintech_sub = $1
                 ORDER BY t.tracked_at DESC
                 LIMIT $2 OFFSET $3`,
                [sub, limit, offset]
            );

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ items: rows, total, limit, offset }),
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error in portfolio-get:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal Server Error', message: error.message }),
        };
    }
};
