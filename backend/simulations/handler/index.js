const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { DynamoDBClient, TransactWriteItemsCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

const sqsClient = new SQSClient({});
const dynamoClient = new DynamoDBClient({});

const QUEUE_URL = process.env.SQS_QUEUE_URL;
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE_NAME;
const DYNAMODB_USER_TABLE = process.env.DYNAMODB_USER_TABLE;
const DYNAMODB_PORTFOLIO_TABLE = process.env.DYNAMODB_PORTFOLIO_TABLE;

// Los headers CORS los inyecta API Gateway (cors_configuration en
// api-gateway.tf) cuando vienen de un origin permitido. No los devolvemos
// desde el Lambda porque, en HTTP API v2, los headers de la integración
// pisan los del cors_configuration y un "*" hardcodeado anularía la
// restricción del gateway. Lo mismo aplica al preflight OPTIONS: HTTP API
// v2 lo responde solo, no necesita route ni handler propio.
const headers = { "Content-Type": "application/json" };

exports.handler = async (event) => {
    try {
        console.log("Event received:", JSON.stringify(event));

        const httpMethod = event.requestContext?.http?.method || event.httpMethod;
        const body = event.body;

        if (httpMethod === 'POST') {
            if (!body) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: "Falta el body" }) };
            }

            let parsedBody;
            try {
                parsedBody = JSON.parse(body);
            } catch (parseError) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: "JSON inválido en el body" }) };
            }
            const cuit = parsedBody.cuit;

            if (!cuit) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: "Falta 'cuit' en el body" })
                };
            }

            const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
            if (!sub) {
                return { statusCode: 401, headers, body: JSON.stringify({ error: "No se pudo obtener el sub del token" }) };
            }

            if (!DYNAMODB_TABLE || !DYNAMODB_USER_TABLE || !DYNAMODB_PORTFOLIO_TABLE) {
                console.error("Required DynamoDB table env vars are not set");
                return { statusCode: 500, headers, body: JSON.stringify({ error: "Configuración interna del servidor incompleta (DynamoDB)" }) };
            }

            const taskId = uuidv4();
            const timestamp = new Date().toISOString();

            // All four writes go in a single transaction so the request either
            // persists everything (user-cuit relation + portfolio INFO seed +
            // portfolio fintech-cuit relation + simulation record) or nothing.
            // Avoids the previous race where one of the writes could succeed
            // while another failed silently, leaving the data inconsistent.
            try {
                await dynamoClient.send(new TransactWriteItemsCommand({
                    TransactItems: [
                        {
                            Put: {
                                TableName: DYNAMODB_USER_TABLE,
                                Item: {
                                    sub:  { S: sub },
                                    cuit: { S: cuit }
                                }
                            }
                        },
                        {
                            Update: {
                                TableName: DYNAMODB_PORTFOLIO_TABLE,
                                Key: { pk: { S: `CUIT#${cuit}` }, sk: { S: 'INFO' } },
                                // record_type se setea siempre (no if_not_exists) para que
                                // el sparse GSI record-type-pk-index también capture items
                                // INFO legados creados antes de existir el índice. Para
                                // los demás campos preservamos el valor previo si ya estaba
                                // (la fintech podría no ser la primera en trackear este CUIT).
                                UpdateExpression: "SET current_status = if_not_exists(current_status, :s), previous_status = if_not_exists(previous_status, :s), trend = if_not_exists(trend, :t), last_updated = if_not_exists(last_updated, :lu), record_type = :rt",
                                ExpressionAttributeValues: {
                                    ":s":  { S: "1" },
                                    ":t":  { S: "stable" },
                                    ":lu": { S: timestamp },
                                    ":rt": { S: "INFO" }
                                }
                            }
                        },
                        {
                            Put: {
                                TableName: DYNAMODB_PORTFOLIO_TABLE,
                                Item: {
                                    pk:         { S: `CUIT#${cuit}` },
                                    sk:         { S: `FINTECH#${sub}` },
                                    gsi1_pk:    { S: `FINTECH#${sub}` },
                                    gsi1_sk:    { S: `CUIT#${cuit}` },
                                    tracked_at: { S: timestamp }
                                }
                            }
                        },
                        {
                            Put: {
                                TableName: DYNAMODB_TABLE,
                                Item: {
                                    sub:        { S: sub },
                                    sk:         { S: `CUIT#${cuit}#TASK#${taskId}` },
                                    task_id:    { S: taskId },
                                    cuit:       { S: cuit },
                                    status:     { S: "PROCESSING" },
                                    created_at: { S: timestamp }
                                }
                            }
                        }
                    ]
                }));
                console.log(`Transaction committed: user + portfolio + simulation rows for task_id ${taskId}`);
            } catch (txError) {
                console.error("DynamoDB transaction failed:", txError);
                return { statusCode: 500, headers, body: JSON.stringify({ error: "Error interno al inicializar simulación" }) };
            }

            if (QUEUE_URL) {
                await sqsClient.send(new SendMessageCommand({
                    QueueUrl: QUEUE_URL,
                    MessageBody: JSON.stringify({
                        task_id:   taskId,
                        cuit:      cuit,
                        sub:       sub,
                        timestamp: timestamp
                    })
                }));
                console.log(`Message sent to SQS for task_id: ${taskId}`);
            } else {
                console.warn("SQS_QUEUE_URL is not defined in environment variables.");
                return { statusCode: 500, headers, body: JSON.stringify({ error: "Configuración interna del servidor incompleta (SQS)" }) };
            }

            return {
                statusCode: 202,
                headers,
                body: JSON.stringify({
                    message: "Simulación iniciada",
                    task_id: taskId,
                    status: "PROCESSING"
                })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Ruta no encontrada o método no permitido" })
        };

    } catch (error) {
        console.error("API error:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Error interno del servidor", message: error.message })
        };
    }
};
