const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const smClient = new SecretsManagerClient({ region: 'us-east-1' });
let poolPromise;

function getPool() {
    if (!poolPromise) {
        poolPromise = (async () => {
            const { SecretString } = await smClient.send(
                new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
            );
            const { username, password } = JSON.parse(SecretString);
            return new Pool({
                host: process.env.DB_HOST,
                port: parseInt(process.env.DB_PORT, 10),
                database: process.env.DB_NAME,
                user: username,
                password,
                ssl: { rejectUnauthorized: false },
            });
        })().catch((err) => {
            poolPromise = undefined;
            throw err;
        });
    }
    return poolPromise;
}

const BCRA_BASE_URL = 'https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas';
const BCRA_HEADERS = {
    'Cache-Control': 'no-cache',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function consultarBCRA(cuit) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        attempt++;
        try {
            const res = await fetch(`${BCRA_BASE_URL}/${cuit}`, {
                headers: BCRA_HEADERS,
                signal: AbortSignal.timeout(15_000),
            });

            if (res.status === 404) {
                console.log(`CUIT ${cuit}: sin historial en BCRA (404), skipping.`);
                return null;
            }

            if (!res.ok) {
                throw new Error(`BCRA respondió HTTP ${res.status} para CUIT ${cuit}`);
            }

            const body = await res.json();
            return body.results ?? null;
        } catch (err) {
            console.warn(`[Intento ${attempt}/${maxRetries}] Error consultando BCRA para CUIT ${cuit}: ${err.message}`);
            if (attempt >= maxRetries) {
                throw err;
            }
            // Wait before retry: 1s for 1st retry, 2s for 2nd retry
            await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
    }
}

function derivarSituacion(results) {
    const periodos = results?.periodos ?? [];
    if (periodos.length === 0) return null;

    const situaciones = (periodos[0]?.entidades ?? [])
        .map((e) => parseInt(e.situacion, 10))
        .filter((s) => Number.isInteger(s) && s >= 1 && s <= 6);

    return situaciones.length === 0 ? null : Math.max(...situaciones);
}

exports.handler = async (event) => {
    console.log('Iniciando portfolio-updater (BCRA real).');

    const sub = event?.requestContext?.authorizer?.jwt?.claims?.sub;
    const client = await (await getPool()).connect();
    let updated = 0;
    let skipped = 0;
    let noData = 0;
    let errors = 0;

    try {
        // Verificar si las tablas existen antes de consultar
        const tableCheck = await client.query(`
            SELECT (
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'portfolio_tracking'
                )
            ) AND (
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'portfolio_cuits'
                )
            ) AS exists
        `);
        const tablesExist = tableCheck.rows[0].exists;

        if (!tablesExist) {
            if (sub) {
                console.log(`La fintech ${sub} tiene una cartera vacía (las tablas no existen aún).`);
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: 'Tu cartera está vacía. Realizá al menos una simulación en el simulador para registrar deudores.'
                    })
                };
            } else {
                console.log('No existen las tablas del portfolio todavía. Saltando ejecución.');
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: 'Tablas de base de datos no creadas aún. Saltando actualización.' })
                };
            }
        }

        let rows;
        if (sub) {
            console.log(`Actualizando cartera para fintech_sub: ${sub}`);
            const result = await client.query(
                `SELECT c.cuit, c.current_status, c.trend, c.last_processed_period
                 FROM portfolio_tracking t
                 JOIN portfolio_cuits c ON t.cuit = c.cuit
                 WHERE t.fintech_sub = $1`,
                [sub]
            );
            rows = result.rows;

            if (rows.length === 0) {
                console.log(`La fintech ${sub} tiene una cartera vacía.`);
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: 'Tu cartera está vacía. Realizá al menos una simulación en el simulador para registrar clientes.'
                    })
                };
            }
        } else {
            console.log('Actualizando todos los CUITs de forma global (ejecución cron mensual).');
            const result = await client.query(
                'SELECT cuit, current_status, trend, last_processed_period FROM portfolio_cuits'
            );
            rows = result.rows;
        }

        console.log(`Encontrados ${rows.length} CUITs en cartera.`);

        const currentPeriod = new Date().toISOString().slice(0, 7);

        for (const item of rows) {
            if (item.last_processed_period === currentPeriod) {
                skipped++;
                continue;
            }

            let results;
            try {
                results = await consultarBCRA(item.cuit);
            } catch (err) {
                console.error(`Error consultando BCRA para CUIT ${item.cuit} después de reintentos: ${err.message}`);
                errors++;
                continue;
            }

            if (results === null) {
                noData++;
                await client.query(
                    'UPDATE portfolio_cuits SET last_processed_period = $1, current_status = 0, situacion = 0 WHERE cuit = $2',
                    [currentPeriod, item.cuit]
                );
                continue;
            }

            const newStatusNum = derivarSituacion(results);
            if (newStatusNum === null) {
                console.log(`CUIT ${item.cuit}: no se pudo derivar situación del BCRA, setting current_status to 0.`);
                noData++;
                await client.query(
                    'UPDATE portfolio_cuits SET last_processed_period = $1, current_status = 0, situacion = 0 WHERE cuit = $2',
                    [currentPeriod, item.cuit]
                );
                continue;
            }

            const newStatus = newStatusNum;
            const prevStatus = parseInt(item.current_status, 10);
            let trend = 'stable';
            if (newStatus > prevStatus) trend = 'down';
            else if (newStatus < prevStatus) trend = 'up';

            await client.query(
                `UPDATE portfolio_cuits
                 SET last_processed_period = $1,
                     current_status = $2,
                     previous_status = $3,
                     trend = $4,
                     last_updated = NOW()
                 WHERE cuit = $5`,
                [currentPeriod, newStatus, prevStatus, trend, item.cuit]
            );

            console.log(`CUIT ${item.cuit}: ${prevStatus} → ${newStatus} (${trend})`);
            updated++;
        }

        console.log(`Portfolio-updater completado. Actualizados: ${updated} | Sin datos BCRA: ${noData} | Ya procesados: ${skipped} | Errores: ${errors}`);
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Portfolio actualizado. Actualizados: ${updated} | Sin datos: ${noData} | Ya procesados: ${skipped}${errors > 0 ? ` | Errores de red: ${errors}` : ''}`
            })
        };
    } catch (error) {
        console.error('Error fatal en portfolio-updater:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Error interno del servidor', message: error.message })
        };
    } finally {
        client.release();
    }
};
