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

const headers = { 
    'Content-Type': 'application/json',
    'Access-Control-Expose-Headers': 'X-Portfolio-Empty'
};


exports.handler = async (event) => {
    try {
        const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
        if (!sub) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        const query = event.queryStringParameters || {};

        const parseQueryInt = (val, fallback) => {
            if (val === undefined || val === null || val === 'null' || val === 'undefined' || val === '') return fallback;
            const parsed = parseInt(val, 10);
            return Number.isNaN(parsed) ? fallback : parsed;
        };

        const parseQueryFloat = (val, fallback) => {
            if (val === undefined || val === null || val === 'null' || val === 'undefined' || val === '') return fallback;
            const parsed = parseFloat(val);
            return Number.isNaN(parsed) ? fallback : parsed;
        };

        const curr_sit = parseQueryInt(query.curr_sit, 2);
        const curr_cant = parseQueryInt(query.curr_cant, 3);
        const curr_deuda = parseQueryFloat(query.curr_deuda, 350000);
        const curr_meses = parseQueryInt(query.curr_meses, 6);
        const curr_dias = parseQueryInt(query.curr_dias, 30);
        const curr_proceso = query.curr_proceso === 'true';

        const sim_sit = parseQueryInt(query.sim_sit, undefined);
        const sim_cant = parseQueryInt(query.sim_cant, undefined);
        const sim_deuda = parseQueryFloat(query.sim_deuda, undefined);
        const sim_meses = parseQueryInt(query.sim_meses, undefined);
        const sim_dias = parseQueryInt(query.sim_dias, undefined);
        const sim_proceso = query.sim_proceso === 'true';

        if (
            sim_sit === undefined || sim_cant === undefined || sim_deuda === undefined ||
            sim_meses === undefined || sim_dias === undefined || query.sim_proceso === undefined
        ) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan parámetros simulados' }) };
        }

        const client = await (await getPool()).connect();
        try {
            // Verificar si la tabla existe antes de consultar
            const tableCheck = await client.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'portfolio_tracking'
                )
            `);
            const tablesExist = tableCheck.rows[0].exists;

            if (!tablesExist) {
                return {
                    statusCode: 200,
                    headers: { ...headers, 'X-Portfolio-Empty': 'true' },
                    body: JSON.stringify({
                        empty: true,
                        total_portfolio_count: 0,
                        total_scored: 0,
                    }),
                };
            }

            const portfolioCount = await client.query(
                'SELECT COUNT(*) FROM portfolio_tracking WHERE fintech_sub = $1',
                [sub]
            );
            const total_portfolio_count = parseInt(portfolioCount.rows[0].count, 10);

            const scoredCount = await client.query(
                `SELECT COUNT(*) FROM portfolio_cuits c
                 JOIN portfolio_tracking t ON c.cuit = t.cuit
                 WHERE t.fintech_sub = $1 AND c.score IS NOT NULL`,
                [sub]
            );
            const total_scored = parseInt(scoredCount.rows[0].count, 10);

            if (total_scored === 0) {
                return {
                    statusCode: 200,
                    headers: { ...headers, 'X-Portfolio-Empty': 'true' },
                    body: JSON.stringify({
                        empty: true,
                        total_portfolio_count,
                        total_scored: 0,
                    }),
                };
            }

            const { rows } = await client.query(`
                WITH fintech_portfolio AS (
                    SELECT c.*
                    FROM portfolio_cuits c
                    JOIN portfolio_tracking t ON c.cuit = t.cuit
                    WHERE t.fintech_sub = $1 AND c.score IS NOT NULL
                ),
                eval_portfolio AS (
                    SELECT *,
                        (situacion <= $2 AND cant_entidades <= $3 AND deuda_total_ars <= $4
                         AND meses_en_sit1 >= $5 AND dias_atraso_max <= $6
                         AND ($7 OR NOT proceso_judicial)) AS passes_current,
                        (situacion <= $8 AND cant_entidades <= $9 AND deuda_total_ars <= $10
                         AND meses_en_sit1 >= $11 AND dias_atraso_max <= $12
                         AND ($13 OR NOT proceso_judicial)) AS passes_simulated
                    FROM fintech_portfolio
                )
                SELECT
                    COUNT(*)::int AS total_portfolio,
                    COUNT(*) FILTER (WHERE passes_current)::int AS current_approved_count,
                    COUNT(*) FILTER (WHERE passes_simulated)::int AS simulated_approved_count,
                    COUNT(*) FILTER (WHERE NOT passes_current AND passes_simulated)::int AS newly_eligible,
                    COUNT(*) FILTER (WHERE passes_current AND NOT passes_simulated)::int AS newly_rejected,
                    COUNT(*) FILTER (WHERE situacion > $8)::int AS reject_by_situacion,
                    COUNT(*) FILTER (WHERE cant_entidades > $9)::int AS reject_by_entidades,
                    COUNT(*) FILTER (WHERE deuda_total_ars > $10)::int AS reject_by_deuda,
                    COUNT(*) FILTER (WHERE meses_en_sit1 < $11)::int AS reject_by_meses,
                    COUNT(*) FILTER (WHERE dias_atraso_max > $12)::int AS reject_by_dias,
                    COUNT(*) FILTER (WHERE proceso_judicial AND NOT $13)::int AS reject_by_judicial,
                    ROUND(AVG(score) FILTER (WHERE passes_current)::numeric, 4) AS current_avg_score,
                    ROUND(AVG(score) FILTER (WHERE passes_simulated)::numeric, 4) AS simulated_avg_score,
                    ROUND(SUM(deuda_total_ars) FILTER (WHERE passes_current)::numeric, 2) AS current_eligible_debt,
                    ROUND(SUM(deuda_total_ars) FILTER (WHERE passes_simulated)::numeric, 2) AS simulated_eligible_debt,
                    ROUND(AVG(cant_entidades)::numeric, 2) AS avg_entidades,
                    ROUND(AVG(deuda_total_ars)::numeric, 2) AS avg_deuda,
                    ROUND(AVG(meses_en_sit1)::numeric, 2) AS avg_meses_sit1,
                    COUNT(*) FILTER (WHERE proceso_judicial)::int AS count_judicial,
                    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score)::numeric, 4) AS median_score,
                    COUNT(*) FILTER (WHERE score >= 0.7)::int AS high_score_count,
                    COUNT(*) FILTER (WHERE score >= 0.4 AND score < 0.7)::int AS mid_score_count,
                    COUNT(*) FILTER (WHERE score < 0.4)::int AS low_score_count
                FROM eval_portfolio
            `, [
                sub,
                curr_sit, curr_cant, curr_deuda, curr_meses, curr_dias, curr_proceso,
                sim_sit, sim_cant, sim_deuda, sim_meses, sim_dias, sim_proceso,
            ]);

            const result = rows[0];
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    empty: false,
                    ...result,
                }),
            };
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Error in simulate-config:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Error interno del servidor', message: error.message }),
        };
    }
};
