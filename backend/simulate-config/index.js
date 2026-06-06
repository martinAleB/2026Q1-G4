const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
});

const headers = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
    try {
        const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
        if (!sub) {
            return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        const query = event.queryStringParameters || {};

        const curr_sit = query.curr_sit !== undefined ? parseInt(query.curr_sit, 10) : 2;
        const curr_cant = query.curr_cant !== undefined ? parseInt(query.curr_cant, 10) : 3;
        const curr_deuda = query.curr_deuda !== undefined ? parseFloat(query.curr_deuda) : 350000;
        const curr_meses = query.curr_meses !== undefined ? parseInt(query.curr_meses, 10) : 6;
        const curr_dias = query.curr_dias !== undefined ? parseInt(query.curr_dias, 10) : 30;
        const curr_proceso = query.curr_proceso === 'true';

        const sim_sit = query.sim_sit !== undefined ? parseInt(query.sim_sit, 10) : undefined;
        const sim_cant = query.sim_cant !== undefined ? parseInt(query.sim_cant, 10) : undefined;
        const sim_deuda = query.sim_deuda !== undefined ? parseFloat(query.sim_deuda) : undefined;
        const sim_meses = query.sim_meses !== undefined ? parseInt(query.sim_meses, 10) : undefined;
        const sim_dias = query.sim_dias !== undefined ? parseInt(query.sim_dias, 10) : undefined;
        const sim_proceso = query.sim_proceso === 'true';

        if (
            sim_sit === undefined || sim_cant === undefined || sim_deuda === undefined ||
            sim_meses === undefined || sim_dias === undefined || query.sim_proceso === undefined
        ) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan parámetros simulados' }) };
        }

        const client = await pool.connect();
        try {
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
                    headers,
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
