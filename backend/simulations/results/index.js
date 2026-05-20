const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE_NAME;

// Headers CORS los inyecta API Gateway (cors_configuration en api-gateway.tf);
// si los devolvemos desde el Lambda pisan la config del gateway.
const headers = { "Content-Type": "application/json" };

exports.handler = async (event) => {
    try {
        console.log("Event received:", JSON.stringify(event));

        const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
        if (!sub) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: "No se pudo obtener el sub del token" }) };
        }

        const { queryStringParameters } = event;
        const { cuit, task_id } = queryStringParameters || {};

        // Tres patrones de acceso:
        // - task_id: Query directo sobre el GSI task-id-sub-index, devuelve
        //   un único item validando ownership en la KeyCondition.
        // - cuit (sin task_id): Query sobre la tabla principal usando el
        //   prefijo del sk (begins_with).
        // - sin filtros: Query sobre la tabla principal listando todas las
        //   simulaciones del tenant.
        let queryParams;
        if (task_id) {
            queryParams = {
                TableName: DYNAMODB_TABLE,
                IndexName: "task-id-sub-index",
                KeyConditionExpression: "task_id = :tid AND #sub = :sub",
                ExpressionAttributeNames: { "#sub": "sub" },
                ExpressionAttributeValues: { ":tid": task_id, ":sub": sub }
            };
        } else if (cuit) {
            queryParams = {
                TableName: DYNAMODB_TABLE,
                KeyConditionExpression: "#sub = :sub AND begins_with(sk, :sk_prefix)",
                ExpressionAttributeNames: { "#sub": "sub" },
                ExpressionAttributeValues: { ":sub": sub, ":sk_prefix": `CUIT#${cuit}` }
            };
        } else {
            queryParams = {
                TableName: DYNAMODB_TABLE,
                KeyConditionExpression: "#sub = :sub",
                ExpressionAttributeNames: { "#sub": "sub" },
                ExpressionAttributeValues: { ":sub": sub }
            };
        }

        const data = await docClient.send(new QueryCommand(queryParams));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                results: data.Items
            })
        };

    } catch (error) {
        console.error("Error querying results:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Error interno al consultar resultados", message: error.message })
        };
    }
};
