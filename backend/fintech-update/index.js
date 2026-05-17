'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const TABLE = process.env.DYNAMODB_FINTECH_TABLE;

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  try {
    const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!sub) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'No autorizado' }),
      };
    }

    const body = JSON.parse(event.body || '{}');
    const { fintech_name } = body;

    if (!fintech_name) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'El nombre de la fintech es obligatorio' }),
      };
    }

    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { sub },
      UpdateExpression: 'SET fintech_name = :fn',
      ExpressionAttributeValues: {
        ':fn': fintech_name,
      },
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Fintech actualizada con éxito' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error interno del servidor' }),
    };
  }
};
