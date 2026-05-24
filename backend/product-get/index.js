'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_PRODUCT_TABLE;

function respond(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

exports.handler = async (event) => {

  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return respond(401, { error: 'No autorizado' });

  try {
    const { Items } = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: '#sub = :sub',
      ExpressionAttributeNames: { '#sub': 'sub' },
      ExpressionAttributeValues: { ':sub': sub },
    }));
    return respond(200, Items);
  } catch (err) {
    console.error('Internal error:', err);
    return respond(500, { error: 'Error interno del servidor', message: err.message });
  }
};
