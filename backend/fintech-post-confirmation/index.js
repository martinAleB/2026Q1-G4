'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_FINTECH_TABLE;

exports.handler = async (event) => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') return event;

  const { sub, email } = event.request.userAttributes;

  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      sub,
      email,
      max_situacion_crediticia: 2,
      max_entidades_con_deuda: 3,
      max_deuda_total_ars: 350000,
      min_meses_situacion_1: 6,
      max_dias_atraso: 30,
      permite_proceso_judicial: false,
    },
  }));

  return event;
};
