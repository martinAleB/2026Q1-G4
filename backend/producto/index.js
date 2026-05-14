'use strict';

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { Pool } = require('pg');

const smClient = new SecretsManagerClient({ region: 'us-east-1' });

let pool = null;

async function getPool() {
  if (pool) return pool;

  const { SecretString } = await smClient.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRET_ARN })
  );
  const { username, password } = JSON.parse(SecretString);

  pool = new Pool({
    host:             process.env.DB_HOST,
    port:             parseInt(process.env.DB_PORT, 10),
    database:         process.env.DB_NAME,
    user:             username,
    password,
    ssl:              { rejectUnauthorized: false },
    max:              1,
    idleTimeoutMillis: 0,
  });

  return pool;
}

const HEADERS = {
  'Content-Type':                 'application/json',
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

function respond(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

const REQUIRED_FIELDS = ['nombre', 'monto', 'cuotas', 'interes', 'plazo', 'min_sit_cred', 'max_sit_cred'];

function validateBody(body) {
  const missing = REQUIRED_FIELDS.filter(f => body[f] === undefined);
  return missing.length > 0
    ? `Missing required fields: ${missing.join(', ')}`
    : null;
}

exports.handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method;
    const path   = event.requestContext?.http?.path;

    if (method === 'OPTIONS') {
      return { statusCode: 200, headers: HEADERS, body: '' };
    }

    const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!sub) {
      return respond(401, { error: 'Unauthorized' });
    }

    const db = await getPool();

    // GET /producto
    if (method === 'GET' && path === '/producto') {
      const { rows } = await db.query(
        'SELECT id, sub, nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred FROM producto WHERE sub = $1 ORDER BY id',
        [sub]
      );
      return respond(200, rows);
    }

    // POST /producto
    if (method === 'POST' && path === '/producto') {
      let body;
      try { body = JSON.parse(event.body || '{}'); }
      catch { return respond(400, { error: 'Invalid JSON body' }); }

      const validationError = validateBody(body);
      if (validationError) return respond(400, { error: validationError });

      const { nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred } = body;
      const { rows } = await db.query(
        `INSERT INTO producto (sub, nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, sub, nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred`,
        [sub, nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred]
      );
      return respond(201, rows[0]);
    }

    // PUT /producto/{id}
    if (method === 'PUT') {
      const id = event.pathParameters?.id;
      if (!id || !/^\d+$/.test(id)) {
        return respond(400, { error: 'Invalid or missing path parameter: id' });
      }

      let body;
      try { body = JSON.parse(event.body || '{}'); }
      catch { return respond(400, { error: 'Invalid JSON body' }); }

      const validationError = validateBody(body);
      if (validationError) return respond(400, { error: validationError });

      const { nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred } = body;
      const { rows } = await db.query(
        `UPDATE producto
         SET nombre = $1, monto = $2, cuotas = $3, interes = $4,
             plazo = $5, min_sit_cred = $6, max_sit_cred = $7
         WHERE id = $8 AND sub = $9
         RETURNING id, sub, nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred`,
        [nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred, parseInt(id, 10), sub]
      );
      if (rows.length === 0) return respond(404, { error: 'Producto not found or access denied' });
      return respond(200, rows[0]);
    }

    // DELETE /producto/{id}
    if (method === 'DELETE') {
      const id = event.pathParameters?.id;
      if (!id || !/^\d+$/.test(id)) {
        return respond(400, { error: 'Invalid or missing path parameter: id' });
      }

      const { rowCount } = await db.query(
        'DELETE FROM producto WHERE id = $1 AND sub = $2',
        [parseInt(id, 10), sub]
      );
      if (rowCount === 0) return respond(404, { error: 'Producto not found or access denied' });
      return respond(200, { message: 'Producto deleted successfully' });
    }

    return respond(404, { error: 'Route not found' });

  } catch (err) {
    console.error('Internal error:', err);
    return respond(500, { error: 'Internal server error', message: err.message });
  }
};
