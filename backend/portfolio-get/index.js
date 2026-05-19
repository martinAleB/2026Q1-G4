const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_PORTFOLIO_TABLE;

exports.handler = async (event) => {
    try {
        const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
        if (!sub) {
            return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized" }) };
        }

        // 1. Get tracked CUITs for the fintech
        const { Items: trackedItems } = await docClient.send(new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'gsi1',
            KeyConditionExpression: 'gsi1_pk = :fintech_id',
            ExpressionAttributeValues: {
                ':fintech_id': `FINTECH#${sub}`
            }
        }));

        if (!trackedItems || trackedItems.length === 0) {
            return {
                statusCode: 200,
                headers: { 
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*" 
                },
                body: JSON.stringify([])
            };
        }

        // 2. Extract CUIT pks
        const cuitPks = trackedItems.map(item => item.gsi1_sk);

        // 3. BatchGet the INFO items
        const keys = cuitPks.map(pk => ({
            pk: pk,
            sk: 'INFO'
        }));

        const maxBatchSize = 100;
        const resultItems = [];

        for (let i = 0; i < keys.length; i += maxBatchSize) {
            const batchKeys = keys.slice(i, i + maxBatchSize);
            const { Responses } = await docClient.send(new BatchGetCommand({
                RequestItems: {
                    [TABLE_NAME]: {
                        Keys: batchKeys
                    }
                }
            }));
            
            if (Responses && Responses[TABLE_NAME]) {
                resultItems.push(...Responses[TABLE_NAME]);
            }
        }

        // Combine the tracked items with their info
        const response = resultItems.map(infoItem => {
            const trackInfo = trackedItems.find(t => t.gsi1_sk === infoItem.pk);
            return {
                cuit: infoItem.pk.split('#')[1],
                current_status: infoItem.current_status,
                previous_status: infoItem.previous_status,
                trend: infoItem.trend,
                last_updated: infoItem.last_updated,
                tracked_at: trackInfo?.tracked_at
            };
        });

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error("Error fetching portfolio:", error);
        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({ error: "Internal Server Error" })
        };
    }
};
