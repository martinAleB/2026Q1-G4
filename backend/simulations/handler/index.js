const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { DynamoDBClient, TransactWriteItemsCommand } = require('@aws-sdk/client-dynamodb');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const sqsClient = new SQSClient({});
const dynamoClient = new DynamoDBClient({});

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

const QUEUE_URL = process.env.SQS_QUEUE_URL;
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE_NAME;
const DYNAMODB_USER_TABLE = process.env.DYNAMODB_USER_TABLE;

const headers = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
    try {
        console.log('Event received:', JSON.stringify(event));

        const httpMethod = event.requestContext?.http?.method || event.httpMethod;

        if (httpMethod !== 'POST') {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Ruta no encontrada o método no permitido' }) };
        }

        if (!event.body) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el body' }) };
        }

        let parsedBody;
        try {
            parsedBody = JSON.parse(event.body);
        } catch {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido en el body' }) };
        }

        const { cuit } = parsedBody;
        if (!cuit) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Falta 'cuit' en el body" }) };
        }

        const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
        if (!sub) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'No se pudo obtener el sub del token' }) };
        }

        if (!DYNAMODB_TABLE || !DYNAMODB_USER_TABLE) {
            console.error('Required DynamoDB table env vars are not set');
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuración interna del servidor incompleta (DynamoDB)' }) };
        }

        if (!QUEUE_URL) {
            console.error('SQS_QUEUE_URL is not set');
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuración interna del servidor incompleta (SQS)' }) };
        }

        const taskId = uuidv4();
        const timestamp = new Date().toISOString();

        const dbClient = await pool.connect();
        try {
            await dbClient.query(
                `INSERT INTO portfolio_cuits (cuit, current_status, previous_status, trend, last_updated)
                 VALUES ($1, 0, 0, 'stable', NOW())
                 ON CONFLICT (cuit) DO NOTHING`,
                [cuit]
            );
            await dbClient.query(
                `INSERT INTO portfolio_tracking (fintech_sub, cuit, tracked_at)
                 VALUES ($1, $2, NOW())
                 ON CONFLICT (fintech_sub, cuit) DO NOTHING`,
                [sub, cuit]
            );
        } catch (rdsError) {
            console.error('RDS write-ahead failed:', rdsError);
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno al inicializar portfolio en base de datos' }) };
        } finally {
            dbClient.release();
        }

        try {
            await dynamoClient.send(new TransactWriteItemsCommand({
                TransactItems: [
                    {
                        Put: {
                            TableName: DYNAMODB_USER_TABLE,
                            Item: {
                                sub:  { S: sub },
                                cuit: { S: cuit },
                            },
                        },
                    },
                    {
                        Put: {
                            TableName: DYNAMODB_TABLE,
                            Item: {
                                sub:        { S: sub },
                                sk:         { S: `CUIT#${cuit}#TASK#${taskId}` },
                                task_id:    { S: taskId },
                                cuit:       { S: cuit },
                                status:     { S: 'PROCESSING' },
                                created_at: { S: timestamp },
                            },
                        },
                    },
                ],
            }));
            console.log(`Transaction committed: user + simulation rows for task_id ${taskId}`);
        } catch (txError) {
            console.error('DynamoDB transaction failed:', txError);
            return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno al inicializar simulación' }) };
        }

        await sqsClient.send(new SendMessageCommand({
            QueueUrl: QUEUE_URL,
            MessageBody: JSON.stringify({ task_id: taskId, cuit, sub, timestamp }),
        }));
        console.log(`Message sent to SQS for task_id: ${taskId}`);

        return {
            statusCode: 202,
            headers,
            body: JSON.stringify({ message: 'Simulación iniciada', task_id: taskId, status: 'PROCESSING' }),
        };

    } catch (error) {
        console.error('API error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Error interno del servidor', message: error.message }),
        };
    }
};
