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

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return respond(401, { error: 'Unauthorized' });

  const id = event.pathParameters?.id;
  if (!id || !/^\d+$/.test(id)) {
    return respond(400, { error: 'Invalid or missing path parameter: id' });
  }

  try {
    const db = await getPool();
    const { rowCount } = await db.query(
      'DELETE FROM producto WHERE id = $1 AND sub = $2',
      [parseInt(id, 10), sub]
    );
    if (rowCount === 0) return respond(404, { error: 'Producto not found or access denied' });
    return respond(200, { message: 'Producto deleted successfully' });
  } catch (err) {
    console.error('Internal error:', err);
    return respond(500, { error: 'Internal server error', message: err.message });
  }
};
