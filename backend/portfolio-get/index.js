const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, BatchGetCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_PORTFOLIO_TABLE;

// Headers CORS los inyecta API Gateway (cors_configuration en api-gateway.tf);
// si los devolvemos desde el Lambda pisan la config del gateway.
const headers = { "Content-Type": "application/json" };

exports.handler = async (event) => {
    try {
        const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
        if (!sub) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: "Unauthorized" }) };
        }

        const queryParams = event.queryStringParameters || {};
        const limit = parseInt(queryParams.limit) || 20;
        const nextToken = queryParams.next_token;
        const searchCuit = queryParams.cuit;

        let trackedItems = [];
        let lastEvaluatedKey = null;

        // Single-cuit lookup uses the composite key (CUIT, FINTECH#<sub>) so a
        // fintech can only retrieve cuits it has previously tracked — there is
        // no way to probe another fintech's portfolio with this query shape.
        if (searchCuit) {
            const { Item } = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: {
                    pk: `CUIT#${searchCuit}`,
                    sk: `FINTECH#${sub}`
                }
            }));

            if (!Item) {
                // No relation row means either the cuit isn't tracked by this
                // fintech or it doesn't exist at all — same response either way.
                return { statusCode: 200, headers, body: JSON.stringify({ items: [], next_token: null }) };
            }
            trackedItems = [Item];
        } else {
            const queryOptions = {
                TableName: TABLE_NAME,
                IndexName: 'gsi1',
                KeyConditionExpression: 'gsi1_pk = :fintech_id',
                ExpressionAttributeValues: {
                    ':fintech_id': `FINTECH#${sub}`
                },
                Limit: limit
            };

            if (nextToken) {
                try {
                    queryOptions.ExclusiveStartKey = JSON.parse(Buffer.from(nextToken, 'base64').toString());
                } catch (e) {
                    console.error("Invalid token format");
                }
            }

            const result = await docClient.send(new QueryCommand(queryOptions));
            trackedItems = result.Items || [];
            lastEvaluatedKey = result.LastEvaluatedKey ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64') : null;
        }

        if (trackedItems.length === 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ items: [], next_token: null }) };
        }

        // GSI rows store the original PK in `gsi1_sk` (the relation row uses
        // FINTECH#<sub>/CUIT#<cuit> on the GSI, inverted from the main table).
        // For the single-cuit lookup path, the item already has `pk`.
        const cuitPks = trackedItems.map(item => item.gsi1_sk || item.pk);

        const keys = cuitPks.map(pk => ({
            pk: pk,
            sk: 'INFO'
        }));

        const { Responses } = await docClient.send(new BatchGetCommand({
            RequestItems: {
                [TABLE_NAME]: {
                    Keys: keys
                }
            }
        }));
        
        const infoItems = Responses[TABLE_NAME] || [];

        const finalItems = trackedItems.map(trackItem => {
            const pk = trackItem.gsi1_sk || trackItem.pk;
            const infoItem = infoItems.find(info => info.pk === pk);
            
            return {
                cuit: pk.split('#')[1],
                current_status: infoItem?.current_status || "1",
                previous_status: infoItem?.previous_status || "1",
                trend: infoItem?.trend || "stable",
                last_updated: infoItem?.last_updated || trackItem.tracked_at,
                tracked_at: trackItem.tracked_at
            };
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                items: finalItems,
                next_token: lastEvaluatedKey
            })
        };

    } catch (error) {
        console.error("Error in portfolio-get:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: "Internal Server Error", message: error.message })
        };
    }
};
