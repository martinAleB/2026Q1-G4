'use strict';

const { randomUUID } = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const TABLE = process.env.DYNAMODB_PRODUCTO_TABLE;

function respond(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

const REQUIRED_FIELDS = ['nombre', 'monto', 'cuotas', 'interes', 'min_score', 'max_score'];

exports.handler = async (event) => {

  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return respond(401, { error: 'Unauthorized' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { error: 'Invalid JSON body' }); }

  const missing = REQUIRED_FIELDS.filter(f => body[f] === undefined);
  if (missing.length > 0) return respond(400, { error: `Missing required fields: ${missing.join(', ')}` });

  try {
    const { nombre, monto, cuotas, interes, min_score, max_score } = body;
    
    if (min_score > max_score) {
      return respond(400, { error: 'min_score cannot be greater than max_score' });
    }

    const plazo = body.plazo !== undefined ? body.plazo : cuotas;
    const producto_id = randomUUID();
    const item = { sub, producto_id, nombre, monto, cuotas, interes, plazo, min_score, max_score };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return respond(201, item);
  } catch (err) {
    console.error('Internal error:', err);
    return respond(500, { error: 'Internal server error', message: err.message });
  }
};
