'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_FINTECH_TABLE;

function respond(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return respond(401, { error: 'No autorizado' });

  try {
    const { Item } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { sub },
    }));
    if (!Item) return respond(404, { error: 'Fintech no encontrada' });
    return respond(200, Item);
  } catch (err) {
    console.error('Internal error:', err);
    return respond(500, { error: 'Error interno del servidor' });
  }
};
