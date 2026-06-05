'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { enqueueEvaluation } = require('./shared/enqueue');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const QUEUE_URL         = process.env.SQS_QUEUE_URL;
const SIMULATIONS_TABLE = process.env.DYNAMODB_TABLE_NAME;
const USER_TABLE        = process.env.DYNAMODB_USER_TABLE;
const PORTFOLIO_TABLE   = process.env.DYNAMODB_PORTFOLIO_TABLE;

const HEADERS = { 'Content-Type': 'application/json' };

function respond(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

async function handlePost(fintechSub, rawBody) {
  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return respond(400, { error: 'JSON inválido en el body' });
  }

  const { cuit } = parsed;
  if (!cuit) return respond(400, { error: "Falta 'cuit' en el body" });

  const { taskId, status } = await enqueueEvaluation({
    sub: fintechSub, cuit,
    simulationsTable: SIMULATIONS_TABLE,
    userTable: USER_TABLE,
    portfolioTable: PORTFOLIO_TABLE,
    sqsQueueUrl: QUEUE_URL,
  });

  return respond(202, { task_id: taskId, cuit, status });
}

async function handleGet(fintechSub) {
  const result = await ddb.send(new QueryCommand({
    TableName: SIMULATIONS_TABLE,
    KeyConditionExpression: '#sub = :sub',
    ExpressionAttributeNames: { '#sub': 'sub' },
    ExpressionAttributeValues: { ':sub': fintechSub },
  }));

  const byCuit = {};
  for (const item of (result.Items ?? [])) {
    if (!byCuit[item.cuit] || item.created_at > byCuit[item.cuit].created_at) {
      byCuit[item.cuit] = item;
    }
  }

  const evaluations = Object.values(byCuit).map(({ cuit, status, score, created_at, rejection_reasons, error_message }) => ({
    cuit, status,
    score: score !== undefined && score !== null ? Number(score) : null,
    created_at,
    rejection_reasons: rejection_reasons ?? [],
    error_message: error_message ?? null,
  }));

  return respond(200, { evaluations });
}

exports.handler = async (event) => {
  try {
    const fintechSub = event.requestContext?.authorizer?.lambda?.fintech_sub;
    if (!fintechSub) return respond(401, { error: 'No autorizado' });

    const method = event.requestContext?.http?.method;
    if (method === 'POST') return handlePost(fintechSub, event.body);
    if (method === 'GET')  return handleGet(fintechSub);

    return respond(405, { error: 'Método no permitido' });
  } catch (err) {
    console.error('Error in b2b-evaluations:', err);
    return respond(500, { error: 'Error interno del servidor', message: err.message });
  }
};
