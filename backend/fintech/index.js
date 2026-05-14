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
    host:              process.env.DB_HOST,
    port:              parseInt(process.env.DB_PORT, 10),
    database:          process.env.DB_NAME,
    user:              username,
    password,
    ssl:               { rejectUnauthorized: false },
    max:               1,
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

exports.handler = async (event) => {
  // Cognito Post Confirmation trigger
  if (event.triggerSource === 'PostConfirmation_ConfirmSignUp') {
    const sub = event.request.userAttributes.sub;
    const db = await getPool();
    await db.query(
      'INSERT INTO fintech (sub) VALUES ($1)',
      [sub]
    );
    return event;
  }

  // Evento de API Gateway
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

    if (method === 'GET' && path === '/fintech') {
      const { rows } = await db.query(
        'SELECT sub, nombre, max_sit_bcra FROM fintech WHERE sub = $1',
        [sub]
      );
      if (rows.length === 0) return respond(404, { error: 'Fintech not found' });
      return respond(200, rows[0]);
    }

    return respond(404, { error: 'Route not found' });

  } catch (err) {
    console.error('Internal error:', err);
    return respond(500, { error: 'Internal server error', message: err.message });
  }
};
