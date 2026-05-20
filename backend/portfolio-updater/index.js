const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_PORTFOLIO_TABLE;

const BCRA_BASE_URL = "https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas";
const BCRA_HEADERS = {
    "Cache-Control": "no-cache",
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

async function consultarBCRA(cuit) {
    const url = `${BCRA_BASE_URL}/${cuit}`;
    const res = await fetch(url, { headers: BCRA_HEADERS, signal: AbortSignal.timeout(15_000) });

    if (res.status === 404) {
        console.log(`CUIT ${cuit}: sin historial en BCRA (404), skipping.`);
        return null;
    }

    if (!res.ok) {
        throw new Error(`BCRA respondió HTTP ${res.status} para CUIT ${cuit}`);
    }

    const body = await res.json();
    return body.results ?? null;
}

function derivarSituacion(results) {
    const periodos = results?.periodos ?? [];
    if (periodos.length === 0) return null;

    const periodoMasReciente = periodos[0];
    const entidades = periodoMasReciente?.entidades ?? [];

    const situaciones = entidades
        .map(e => parseInt(e.situacion, 10))
        .filter(s => Number.isInteger(s) && s >= 1 && s <= 6);

    if (situaciones.length === 0) return null;

    return Math.max(...situaciones);
}

exports.handler = async (event) => {
    try {
        console.log("Iniciando portfolio-updater (BCRA real).");

        let allItems = [];
        let lastEvaluatedKey = undefined;

        do {
            const response = await docClient.send(new QueryCommand({
                TableName: TABLE_NAME,
                IndexName: "record-type-pk-index",
                KeyConditionExpression: "record_type = :rt",
                ExpressionAttributeValues: { ":rt": "INFO" },
                ExclusiveStartKey: lastEvaluatedKey,
            }));
            if (response.Items) allItems.push(...response.Items);
            lastEvaluatedKey = response.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        console.log(`Encontrados ${allItems.length} CUITs en cartera.`);

        const currentPeriod = new Date().toISOString().slice(0, 7); // "YYYY-MM"
        let skipped = 0;
        let updated = 0;
        let noData = 0;
        let errors = 0;

        for (const item of allItems) {
            if (item.last_processed_period === currentPeriod) {
                skipped++;
                continue;
            }

            const cuit = item.pk.split("#")[1];

            let results;
            try {
                results = await consultarBCRA(cuit);
            } catch (err) {
                console.error(`Error consultando BCRA para CUIT ${cuit}: ${err.message}`);
                errors++;
                throw err;
            }

            if (results === null) {
                noData++;
                await docClient.send(new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { pk: item.pk, sk: item.sk },
                    UpdateExpression: "SET last_processed_period = :p",
                    ExpressionAttributeValues: { ":p": currentPeriod },
                }));
                continue;
            }

            const newStatusNum = derivarSituacion(results);
            if (newStatusNum === null) {
                console.log(`CUIT ${cuit}: no se pudo derivar situación del BCRA, skipping.`);
                noData++;
                continue;
            }

            const newStatus = String(newStatusNum);
            const prevStatus = item.current_status ?? "1";

            let trend = "stable";
            if (parseInt(newStatus, 10) > parseInt(prevStatus, 10)) trend = "down";
            else if (parseInt(newStatus, 10) < parseInt(prevStatus, 10)) trend = "up";

            const statusChanged = newStatus !== prevStatus || trend !== item.trend;

            let updateExpression = "SET last_processed_period = :p";
            const exprValues = { ":p": currentPeriod };

            if (statusChanged) {
                updateExpression += ", current_status = :ns, previous_status = :ps, trend = :t, last_updated = :lu";
                exprValues[":ns"] = newStatus;
                exprValues[":ps"] = prevStatus;
                exprValues[":t"] = trend;
                exprValues[":lu"] = new Date().toISOString();
            }

            await docClient.send(new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { pk: item.pk, sk: item.sk },
                UpdateExpression: updateExpression,
                ExpressionAttributeValues: exprValues,
            }));

            if (statusChanged) {
                console.log(`CUIT ${cuit}: ${prevStatus} → ${newStatus} (${trend})`);
                updated++;
            }
        }

        console.log(`Portfolio-updater completado. Actualizados: ${updated} | Sin datos BCRA: ${noData} | Ya procesados este período: ${skipped} | Errores: ${errors}`);
        return { statusCode: 200, body: "OK" };

    } catch (error) {
        console.error("Error fatal en portfolio-updater:", error);
        throw error;
    }
};
