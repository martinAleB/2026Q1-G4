const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { DynamoDBClient, PutItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');

const sqsClient = new SQSClient({});
const dynamoClient = new DynamoDBClient({});

const QUEUE_URL = process.env.SQS_QUEUE_URL;
const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE_NAME;
const DYNAMODB_USER_TABLE = process.env.DYNAMODB_USER_TABLE;
const DYNAMODB_PORTFOLIO_TABLE = process.env.DYNAMODB_PORTFOLIO_TABLE;

exports.handler = async (event) => {
    try {
        console.log("Event received:", JSON.stringify(event));

        // In API Gateway v2, the method is in requestContext.http.method
        const httpMethod = event.requestContext?.http?.method || event.httpMethod;
        const body = event.body;

        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        };

        if (httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers, body: '' };
        }

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

            await dynamoClient.send(new PutItemCommand({
                TableName: DYNAMODB_USER_TABLE,
                Item: {
                    sub:  { S: sub },
                    cuit: { S: cuit }
                }
            }));

            // Monitoreo Pasivo (Portfolio)
            if (DYNAMODB_PORTFOLIO_TABLE) {
                try {
                    // 1. Guardar o actualizar la info base del CUIT (sólo si no existe, o inicializarla)
                    await dynamoClient.send(new UpdateItemCommand({
                        TableName: DYNAMODB_PORTFOLIO_TABLE,
                        Key: { pk: { S: `CUIT#${cuit}` }, sk: { S: 'INFO' } },
                        UpdateExpression: "SET current_status = if_not_exists(current_status, :s), previous_status = if_not_exists(previous_status, :s), trend = if_not_exists(trend, :t), last_updated = if_not_exists(last_updated, :lu)",
                        ExpressionAttributeValues: {
                            ":s": { S: "1" }, // default status
                            ":t": { S: "stable" },
                            ":lu": { S: new Date().toISOString() }
                        }
                    }));
                    
                    // 2. Guardar la relación Fintech -> CUIT
                    await dynamoClient.send(new PutItemCommand({
                        TableName: DYNAMODB_PORTFOLIO_TABLE,
                        Item: {
                            pk:         { S: `CUIT#${cuit}` },
                            sk:         { S: `FINTECH#${sub}` },
                            gsi1_pk:    { S: `FINTECH#${sub}` },
                            gsi1_sk:    { S: `CUIT#${cuit}` },
                            tracked_at: { S: new Date().toISOString() }
                        }
                    }));
                    console.log(`Saved CUIT ${cuit} to portfolio for fintech ${sub}`);
                } catch (portfolioErr) {
                    console.error("Error updating portfolio table:", portfolioErr);
                    // No interrumpimos el flujo de la simulación por un error en portfolio
                }
            }

            const taskId = uuidv4();
            const timestamp = new Date().toISOString();

            if (DYNAMODB_TABLE) {
                try {
                    await dynamoClient.send(new PutItemCommand({
                        TableName: DYNAMODB_TABLE,
                        Item: {
                            sub:        { S: sub },
                            sk:         { S: `CUIT#${cuit}#TASK#${taskId}` },
                            task_id:    { S: taskId },
                            cuit:       { S: cuit },
                            status:     { S: "PROCESSING" },
                            created_at: { S: timestamp }
                        }
                    }));
                    console.log(`Record created in DynamoDB for task_id: ${taskId}`);
                } catch (dbError) {
                    console.error("Error writing to DynamoDB:", dbError);
                    return { statusCode: 500, headers, body: JSON.stringify({ error: "Error interno al inicializar simulación" }) };
                }
            } else {
                console.warn("DYNAMODB_TABLE_NAME is not defined.");
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
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ 
                error: "Error interno del servidor",
                message: error.message,
                stack: error.stack
            })
        };
    }
};
