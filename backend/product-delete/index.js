'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_PRODUCT_TABLE;

function respond(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

exports.handler = async (event) => {

  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return respond(401, { error: 'No autorizado' });

  const product_id = event.pathParameters?.id;
  if (!product_id) return respond(400, { error: 'Falta el path parameter: id' });

  try {
    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { sub, product_id },
      ConditionExpression: 'attribute_exists(#sub)',
      ExpressionAttributeNames: { '#sub': 'sub' },
    }));
    return respond(200, { message: 'Producto eliminado correctamente' });
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return respond(404, { error: 'Producto no encontrado' });
    }
    console.error('Internal error:', err);
    return respond(500, { error: 'Error interno del servidor', message: err.message });
  }
};
