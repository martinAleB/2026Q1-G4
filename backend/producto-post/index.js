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
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 0,
  });
  return pool;
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

function respond(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

const REQUIRED_FIELDS = ['nombre', 'monto', 'cuotas', 'interes', 'plazo', 'min_sit_cred', 'max_sit_cred'];

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return respond(401, { error: 'Unauthorized' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON body' }); }

  const missing = REQUIRED_FIELDS.filter(f => body[f] === undefined);
  if (missing.length > 0) return respond(400, { error: `Missing required fields: ${missing.join(', ')}` });

  try {
    const db = await getPool();
    const { nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred } = body;
    const { rows } = await db.query(
      `INSERT INTO producto (sub, nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, sub, nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred`,
      [sub, nombre, monto, cuotas, interes, plazo, min_sit_cred, max_sit_cred]
    );
    return respond(201, rows[0]);
  } catch (err) {
    console.error('Internal error:', err);
    return respond(500, { error: 'Internal server error', message: err.message });
  }
};
