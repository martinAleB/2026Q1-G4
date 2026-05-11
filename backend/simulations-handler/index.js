const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { v4: uuidv4 } = require('uuid');

const sqsClient = new SQSClient({});

const QUEUE_URL = process.env.SQS_QUEUE_URL;

exports.handler = async (event) => {
    try {
        console.log("Evento recibido:", JSON.stringify(event));

        const { httpMethod, body } = event;

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
                return { statusCode: 400, headers, body: JSON.stringify({ error: "Body is missing" }) };
            }

            let parsedBody;
            try {
                parsedBody = JSON.parse(body);
            } catch (parseError) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON in request body" }) };
            }
            const cuit = parsedBody.cuit;
            const fintechId = parsedBody.fintech_id || "default_fintech"; // Para probar desde Postman

            if (!cuit) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing 'cuit' in request body" }) };
            }

            const taskId = uuidv4();
            const timestamp = new Date().toISOString();

            if (DYNAMODB_TABLE) {
                try {
                    await dynamoClient.send(new PutItemCommand({
                        TableName: DYNAMODB_TABLE,
                        Item: {
                            pk: { S: `TASK#${taskId}` },
                            sk: { S: `METADATA` },
                            task_id: { S: taskId },
                            fintech_id: { S: fintechId },
                            cuit: { S: cuit },
                            status: { S: "PROCESSING" },
                            created_at: { S: timestamp }
                        }
                    }));
                    console.log(`Registro creado en DynamoDB para task_id: ${taskId}`);
                } catch (dbError) {
                    console.error("Error guardando en DynamoDB:", dbError);
                    return { statusCode: 500, headers, body: JSON.stringify({ error: "Error interno al inicializar simulación" }) };
                }
            } else {
                console.warn("DYNAMODB_TABLE_NAME no está definida.");
            }

            if (QUEUE_URL) {
                await sqsClient.send(new SendMessageCommand({
                    QueueUrl: QUEUE_URL,
                    MessageBody: JSON.stringify({
                        task_id: taskId,
                        cuit: cuit,
                        fintech_id: fintechId,
                        timestamp: timestamp
                    })
                }));
                console.log(`Mensaje enviado a SQS para task_id: ${taskId}`);
            } else {
                console.warn("SQS_QUEUE_URL no está definida en las variables de entorno.");
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
        console.error("Error en la API:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: "Error interno del servidor" })
        };
    }
};
