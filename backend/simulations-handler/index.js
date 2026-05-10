const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { v4: uuidv4 } = require('uuid');

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const sqsClient = new SQSClient({});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'Simulations';
const QUEUE_URL = process.env.SQS_QUEUE_URL;

exports.handler = async (event) => {
    try {
        console.log("Evento recibido:", JSON.stringify(event));

        const { httpMethod, resource, pathParameters, body } = event;

        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
        };

        if (httpMethod === 'OPTIONS') {
            return { statusCode: 200, headers, body: '' };
        }

        if (httpMethod === 'POST') {
            if (!body) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: "Body is missing" }) };
            }

            const parsedBody = JSON.parse(body);
            const cuit = parsedBody.cuit;

            if (!cuit) {
                return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing 'cuit' in request body" }) };
            }

            const taskId = uuidv4();
            const timestamp = new Date().toISOString();

            await docClient.send(new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    task_id: taskId,
                    cuit: cuit,
                    status: 'PROCESSING',
                    created_at: timestamp
                }
            }));

            if (QUEUE_URL) {
                await sqsClient.send(new SendMessageCommand({
                    QueueUrl: QUEUE_URL,
                    MessageBody: JSON.stringify({
                        task_id: taskId,
                        cuit: cuit
                    })
                }));
                console.log(`Mensaje enviado a SQS para task_id: ${taskId}`);
            } else {
                console.warn("SQS_QUEUE_URL no está definida en las variables de entorno.");
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

        if (httpMethod === 'GET' && pathParameters && pathParameters.task_id) {
            const taskId = pathParameters.task_id;

            const response = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: {
                    task_id: taskId
                }
            }));

            if (!response.Item) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: "Task ID no encontrado" })
                };
            }

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(response.Item)
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: "Ruta no encontrada" })
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
