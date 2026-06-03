'use strict';

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const sqs = new SQSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const QUEUE_URL = process.env.SQS_QUEUE_URL;
const SIMULATIONS_TABLE = process.env.DYNAMODB_TABLE_NAME;
const USER_TABLE = process.env.DYNAMODB_USER_TABLE;
const PORTFOLIO_TABLE = process.env.DYNAMODB_PORTFOLIO_TABLE;

// CORS lo inyecta API Gateway; no devolver headers desde el Lambda
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

  const taskId = uuidv4();
  const timestamp = new Date().toISOString();

  try {
    await ddb.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: USER_TABLE,
            Item: { sub: fintechSub, cuit },
          },
        },
        {
          Update: {
            TableName: PORTFOLIO_TABLE,
            Key: { pk: `CUIT#${cuit}`, sk: 'INFO' },
            UpdateExpression: 'SET current_status = if_not_exists(current_status, :s), previous_status = if_not_exists(previous_status, :s), trend = if_not_exists(trend, :t), last_updated = if_not_exists(last_updated, :lu), record_type = :rt',
            ExpressionAttributeValues: { ':s': '1', ':t': 'stable', ':lu': timestamp, ':rt': 'INFO' },
          },
        },
        {
          Put: {
            TableName: PORTFOLIO_TABLE,
            Item: {
              pk: `CUIT#${cuit}`,
              sk: `FINTECH#${fintechSub}`,
              gsi1_pk: `FINTECH#${fintechSub}`,
              gsi1_sk: `CUIT#${cuit}`,
              tracked_at: timestamp,
            },
          },
        },
        {
          Put: {
            TableName: SIMULATIONS_TABLE,
            Item: {
              sub: fintechSub,
              sk: `CUIT#${cuit}#TASK#${taskId}`,
              task_id: taskId,
              cuit,
              status: 'PROCESSING',
              created_at: timestamp,
            },
          },
        },
      ],
    }));
  } catch (err) {
    console.error('Transaction failed:', err);
    return respond(500, { error: 'Error interno al inicializar evaluación' });
  }

  await sqs.send(new SendMessageCommand({
    QueueUrl: QUEUE_URL,
    MessageBody: JSON.stringify({ task_id: taskId, cuit, sub: fintechSub, timestamp }),
  }));

  return respond(202, { task_id: taskId, cuit, status: 'PROCESSING' });
}

async function handleGet(fintechSub) {
  const result = await ddb.send(new QueryCommand({
    TableName: SIMULATIONS_TABLE,
    KeyConditionExpression: '#sub = :sub',
    ExpressionAttributeNames: { '#sub': 'sub' },
    ExpressionAttributeValues: { ':sub': fintechSub },
  }));

  // Un CUIT puede tener múltiples simulaciones; retornar solo la más reciente
  const byCuit = {};
  for (const item of (result.Items ?? [])) {
    if (!byCuit[item.cuit] || item.created_at > byCuit[item.cuit].created_at) {
      byCuit[item.cuit] = item;
    }
  }

  const evaluations = Object.values(byCuit).map(({ cuit, status, score, created_at, rejection_reasons, error_message }) => ({
    cuit,
    status,
    score: score !== undefined && score !== null ? Number(score) : null,
    created_at,
    rejection_reasons: rejection_reasons ?? [],
    error_message: error_message ?? null,
  }));

  return respond(200, { evaluations });
}

exports.handler = async (event) => {
  try {
    // fintech_sub inyectado por el Lambda Authorizer b2b-authorizer
    const fintechSub = event.requestContext?.authorizer?.lambda?.fintech_sub;
    if (!fintechSub) return respond(401, { error: 'No autorizado' });

    const method = event.requestContext?.http?.method;
    if (method === 'POST') return handlePost(fintechSub, event.body);
    if (method === 'GET') return handleGet(fintechSub);

    return respond(405, { error: 'Método no permitido' });
  } catch (err) {
    console.error('Error in b2b-evaluations:', err);
    return respond(500, { error: 'Error interno del servidor', message: err.message });
  }
};
