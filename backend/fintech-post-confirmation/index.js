'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_FINTECH_TABLE;

// Espejado en fintech-get/index.js (fallback lazy del seed). Si se modifica,
// actualizar ambos lugares.
const DEFAULT_FINTECH_ROW = {
  fintech_name: 'Nueva Fintech',
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
      // Idempotent: only insert if the row doesn't already exist. Protects
      // against replays or the trigger firing twice for the same user, and
      // critically does NOT overwrite parameters that the fintech may have
      // already configured via PUT /fintech. `sub` is a DynamoDB reserved
      // keyword, so it must be aliased via ExpressionAttributeNames.
      ConditionExpression: 'attribute_not_exists(#sub)',
      ExpressionAttributeNames: { '#sub': 'sub' },
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      // The row already exists — typical when a confirmed user re-triggers
      // the flow. Nothing to seed.
      console.log(`Fintech row already exists for sub=${sub}, skipping default seed`);
    } else {
      // Anything else (throttle, network, etc.) is propagated so the error
      // shows up in CloudWatch metrics. Cognito has already confirmed the
      // user at this point, so propagating doesn't roll back the signup —
      // it just makes the failure visible to alarms / logs.
      console.error('Failed to seed fintech row:', err);
      throw err;
    }
  }

  return event;
};
