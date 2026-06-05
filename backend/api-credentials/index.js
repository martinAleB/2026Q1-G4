'use strict';

const { createHash, randomBytes } = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const API_CLIENTS_TABLE = process.env.DYNAMODB_API_CLIENTS_TABLE;
const KEY_PREFIX = 'presti_live_';

const HEADERS = { 'Content-Type': 'application/json' };

function respond(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

function generateApiKey() {
  const api_key_id   = randomBytes(4).toString('hex');   // 8 hex chars
  const secret       = randomBytes(16).toString('hex');  // 32 hex chars
  const api_key      = `${KEY_PREFIX}${api_key_id}${secret}`;
  const api_key_hash = createHash('sha256').update(api_key).digest('hex');
  return { api_key_id, api_key, api_key_hash };
}

async function findActiveCredential(fintechSub) {
  const result = await ddb.send(new QueryCommand({
    TableName: API_CLIENTS_TABLE,
    IndexName: 'fintech-sub-index',
    KeyConditionExpression: 'fintech_sub = :sub',
    FilterExpression: 'active = :active',
    ExpressionAttributeValues: { ':sub': fintechSub, ':active': true },
  }));
  return result.Items?.[0] ?? null;
}

async function handleGet(fintechSub) {
  const item = await findActiveCredential(fintechSub);
  if (!item) return respond(200, { exists: false });
  return respond(200, {
    exists: true,
    api_key_id: item.api_key_id,
    created_at: item.created_at,
  });
}

async function handlePost(fintechSub) {
  // Desactivar credencial anterior si existe
  const existing = await findActiveCredential(fintechSub);
  if (existing) {
    await ddb.send(new UpdateCommand({
      TableName: API_CLIENTS_TABLE,
      Key: { api_key_id: existing.api_key_id },
      UpdateExpression: 'SET active = :false',
      ExpressionAttributeValues: { ':false': false },
    }));
  }

  const { api_key_id, api_key, api_key_hash } = generateApiKey();

  await ddb.send(new PutCommand({
    TableName: API_CLIENTS_TABLE,
    Item: {
      api_key_id,
      api_key_hash,
      fintech_sub: fintechSub,
      active: true,
      created_at: new Date().toISOString(),
    },
  }));

  // api_key se retorna una sola vez — nunca se persiste en claro
  return respond(201, { api_key_id, api_key });
}

exports.handler = async (event) => {
  try {
    const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!sub) return respond(401, { error: 'No autorizado' });

    const method = event.requestContext?.http?.method;
    if (method === 'GET')  return handleGet(sub);
    if (method === 'POST') return handlePost(sub);

    return respond(405, { error: 'Método no permitido' });
  } catch (err) {
    console.error('Error in api-credentials:', err);
    return respond(500, { error: 'Error interno del servidor', message: err.message });
  }
};
