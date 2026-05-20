'use strict';

const { randomUUID } = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_PRODUCT_TABLE;

function respond(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

const REQUIRED_FIELDS = ['name', 'amount', 'installments', 'interest', 'min_score', 'max_score', 'priority'];

exports.handler = async (event) => {

  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return respond(401, { error: 'No autorizado' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'JSON inválido en el body' }); }

  const missing = REQUIRED_FIELDS.filter(f => body[f] === undefined);
  if (missing.length > 0) return respond(400, { error: `Faltan campos requeridos: ${missing.join(', ')}` });

  try {
    const { name, amount, installments, interest, min_score, max_score, priority } = body;

    if (min_score > max_score) {
      return respond(400, { error: 'min_score no puede ser mayor que max_score' });
    }

    if (!Number.isInteger(priority) || priority < 1 || priority > 10) {
      return respond(400, { error: 'priority debe ser un entero entre 1 y 10' });
    }

    const term = body.term !== undefined ? body.term : installments;
    const product_id = randomUUID();
    const item = { sub, product_id, name, amount, installments, interest, term, min_score, max_score, priority };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return respond(201, item);
  } catch (err) {
    console.error('Internal error:', err);
    return respond(500, { error: 'Error interno del servidor', message: err.message });
  }
};
