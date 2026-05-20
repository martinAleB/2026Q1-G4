'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_FINTECH_TABLE;

const DEFAULT_FINTECH_ROW = {
  max_situacion_crediticia: 2,
  max_entidades_con_deuda: 3,
  max_deuda_total_ars: 350000,
  min_meses_situacion_1: 6,
  max_dias_atraso: 30,
  permite_proceso_judicial: false,
};

exports.handler = async (event) => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') return event;

  const { sub, email } = event.request.userAttributes;

  try {
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: { sub, email, ...DEFAULT_FINTECH_ROW },
      ConditionExpression: 'attribute_not_exists(#sub)',
      ExpressionAttributeNames: { '#sub': 'sub' },
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      console.log(`Fintech row already exists for sub=${sub}, skipping default seed`);
    } else {
      console.error('Failed to seed fintech row:', err);
      throw err;
    }
  }

  return event;
};
