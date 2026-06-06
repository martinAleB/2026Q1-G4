const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

const BCRA_BASE_URL = 'https://api.bcra.gob.ar/centraldedeudores/v1.0/Deudas';
const BCRA_HEADERS = {
    'Cache-Control': 'no-cache',
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function consultarBCRA(cuit) {
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
}

function derivarSituacion(results) {
    const periodos = results?.periodos ?? [];
    if (periodos.length === 0) return null;

    const situaciones = (periodos[0]?.entidades ?? [])
        .map((e) => parseInt(e.situacion, 10))
        .filter((s) => Number.isInteger(s) && s >= 1 && s <= 6);

    return situaciones.length === 0 ? null : Math.max(...situaciones);
}

exports.handler = async () => {
    console.log('Iniciando portfolio-updater (BCRA real).');

    const client = await pool.connect();
    let updated = 0;
    let skipped = 0;
    let noData = 0;
    let errors = 0;

    try {
        const { rows } = await client.query(
            'SELECT cuit, current_status, trend, last_processed_period FROM portfolio_cuits'
        );
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
                console.error(`Error consultando BCRA para CUIT ${item.cuit}: ${err.message}`);
                errors++;
                throw err;
            }

            if (results === null) {
                noData++;
                await client.query(
                    'UPDATE portfolio_cuits SET last_processed_period = $1 WHERE cuit = $2',
                    [currentPeriod, item.cuit]
                );
                continue;
            }

            const newStatusNum = derivarSituacion(results);
            if (newStatusNum === null) {
                console.log(`CUIT ${item.cuit}: no se pudo derivar situación del BCRA, skipping.`);
                noData++;
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
        return { statusCode: 200, body: 'OK' };
    } catch (error) {
        console.error('Error fatal en portfolio-updater:', error);
        throw error;
    } finally {
        client.release();
    }
};
