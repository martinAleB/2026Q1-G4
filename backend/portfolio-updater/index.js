const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_PORTFOLIO_TABLE;

exports.handler = async (event) => {
    try {
        console.log("Starting portfolio updater cron");

        // 1. Scan for all INFO items
        // In a real production scenario with millions of items, you'd want to parallelize or paginate this
        // using the LastEvaluatedKey. Since this is a monthly job, a loop with pagination is fine.
        let allItems = [];
        let lastEvaluatedKey = undefined;

        do {
            const scanParams = {
                TableName: TABLE_NAME,
                FilterExpression: "sk = :info",
                ExpressionAttributeValues: {
                    ":info": "INFO"
                },
                ExclusiveStartKey: lastEvaluatedKey
            };

            const response = await docClient.send(new ScanCommand(scanParams));
            if (response.Items) {
                allItems.push(...response.Items);
            }
            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        console.log(`Found ${allItems.length} CUITs to update.`);

        // 2. Iterate and update each CUIT
        for (const item of allItems) {
            const cuit = item.pk.split('#')[1];
            
            // Simulating fetching new data from BCRA/Motor
            // Here we randomly decide if the status changes
            let newStatus = item.current_status;
            let trend = "stable";
            
            const randomChance = Math.random();
            if (randomChance > 0.8) {
                // 20% chance to change status for simulation purposes
                const statuses = ["1", "2", "3", "4", "5", "6"];
                newStatus = statuses[Math.floor(Math.random() * statuses.length)];
                
                if (parseInt(newStatus) > parseInt(item.current_status)) {
                    trend = "down"; // Higher number means more risk
                } else if (parseInt(newStatus) < parseInt(item.current_status)) {
                    trend = "up"; // Lower number means less risk (opportunity)
                }
            }

            if (newStatus !== item.current_status || trend !== item.trend) {
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { pk: item.pk, sk: item.sk },
                    UpdateExpression: "SET current_status = :ns, previous_status = :ps, trend = :t, last_updated = :lu",
                    ExpressionAttributeValues: {
                        ":ns": newStatus,
                        ":ps": item.current_status,
                        ":t": trend,
                        ":lu": new Date().toISOString()
                    }
                }));
                console.log(`Updated CUIT ${cuit}: ${item.current_status} -> ${newStatus} (${trend})`);
            }
        }

        console.log("Portfolio updater cron completed.");
        return { statusCode: 200, body: "Success" };

    } catch (error) {
        console.error("Error running portfolio updater:", error);
        throw error;
    }
};
