const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_PORTFOLIO_TABLE;

exports.handler = async (event) => {
    try {
        console.warn("portfolio-updater is a MOCK — status transitions are randomized, no BCRA call is made");
        console.log("Starting portfolio updater cron");

        // Listamos los items INFO via el sparse GSI record-type-pk-index en
        // lugar de Scan + FilterExpression. AWS cobra RCUs por todos los
        // items leídos antes de aplicar el filtro, así que un Scan sobre la
        // tabla portfolio (que también contiene las filas FINTECH#<sub>)
        // cobraba ~2x lo necesario y se volvía más caro a medida que crecía
        // la tabla. Query sobre el sparse GSI devuelve exactamente 1 fila
        // por CUIT trackeado, sin descartes.
        let allItems = [];
        let lastEvaluatedKey = undefined;

        do {
            const response = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: "record-type-pk-index",
                KeyConditionExpression: "record_type = :rt",
                ExpressionAttributeValues: { ":rt": "INFO" },
                ExclusiveStartKey: lastEvaluatedKey
            }));
            if (response.Items) {
                allItems.push(...response.Items);
            }
            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        console.log(`Found ${allItems.length} CUITs to update.`);

        // Marca de idempotencia por mes. Si EventBridge reintenta el cron
        // (retry_policy con maximum_retry_attempts=3) o si un timeout obligó
        // a un reintento parcial, los items ya procesados quedan marcados con
        // last_processed_period = YYYY-MM y se skipean en el siguiente paso.
        // Cuando el flujo deje de ser mock, esto evita llamar dos veces a la
        // API del BCRA por el mismo CUIT en el mismo mes (la API tiene rate
        // limits y es lenta).
        const currentPeriod = new Date().toISOString().slice(0, 7);
        let skipped = 0;

        // 2. Iterate and update each CUIT
        for (const item of allItems) {
            if (item.last_processed_period === currentPeriod) {
                skipped++;
                continue;
            }

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

            // Siempre marcamos last_processed_period (aunque no haya cambio)
            // para que reintentos del mismo mes no reprocesen este CUIT.
            // last_updated en cambio solo se toca cuando el status/trend
            // realmente cambian, para que el dashboard muestre la fecha del
            // último cambio real y no la del último corrida del cron.
            let updateExpression = "SET last_processed_period = :p";
            const exprValues = { ":p": currentPeriod };

            const statusChanged = newStatus !== item.current_status || trend !== item.trend;
            if (statusChanged) {
                updateExpression += ", current_status = :ns, previous_status = :ps, trend = :t, last_updated = :lu";
                exprValues[":ns"] = newStatus;
                exprValues[":ps"] = item.current_status;
                exprValues[":t"] = trend;
                exprValues[":lu"] = new Date().toISOString();
            }

            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { pk: item.pk, sk: item.sk },
                UpdateExpression: updateExpression,
                ExpressionAttributeValues: exprValues
            }));

            if (statusChanged) {
                console.log(`Updated CUIT ${cuit}: ${item.current_status} -> ${newStatus} (${trend})`);
            }
        }

        if (skipped > 0) {
            console.log(`Skipped ${skipped} CUITs already processed for ${currentPeriod}.`);
        }

        console.log("Portfolio updater cron completed.");
        return { statusCode: 200, body: "Success" };

    } catch (error) {
        console.error("Error running portfolio updater:", error);
        throw error;
    }
};
