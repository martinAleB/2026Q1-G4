'use strict';

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const sqs = new SQSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Encola una evaluación crediticia para un CUIT dado.
 * Persiste en una transacción atómica: relación user-cuit, seed de portfolio INFO,
 * relación fintech-cuit en portfolio, y registro de simulación.
 * Luego envía el mensaje a SQS para que el engine lo procese.
 *
 * @param {object} p
 * @param {string} p.sub            sub del fintech (de JWT o del Lambda Authorizer B2B)
 * @param {string} p.cuit           CUIT a evaluar
 * @param {string} p.simulationsTable
 * @param {string} p.userTable
 * @param {string} p.portfolioTable
 * @param {string} p.sqsQueueUrl
 * @returns {{ taskId: string, cuit: string, status: 'PROCESSING' }}
 */
async function enqueueEvaluation({ sub, cuit, simulationsTable, userTable, portfolioTable, sqsQueueUrl }) {
  const taskId = uuidv4();
  const timestamp = new Date().toISOString();

  await ddb.send(new TransactWriteCommand({
    TransactItems: [
      {
        Put: {
          TableName: userTable,
          Item: { sub, cuit },
        },
      },
      {
        Update: {
          TableName: portfolioTable,
          Key: { pk: `CUIT#${cuit}`, sk: 'INFO' },
          // record_type siempre se escribe (no if_not_exists) para que el sparse GSI
          // capture también items INFO creados antes de existir el índice.
          UpdateExpression: 'SET current_status = if_not_exists(current_status, :s), previous_status = if_not_exists(previous_status, :s), trend = if_not_exists(trend, :t), last_updated = if_not_exists(last_updated, :lu), record_type = :rt',
          ExpressionAttributeValues: { ':s': '1', ':t': 'stable', ':lu': timestamp, ':rt': 'INFO' },
        },
      },
      {
        Put: {
          TableName: portfolioTable,
          Item: {
            pk: `CUIT#${cuit}`,
            sk: `FINTECH#${sub}`,
            gsi1_pk: `FINTECH#${sub}`,
            gsi1_sk: `CUIT#${cuit}`,
            tracked_at: timestamp,
          },
        },
      },
      {
        Put: {
          TableName: simulationsTable,
          Item: {
            sub,
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

  await sqs.send(new SendMessageCommand({
    QueueUrl: sqsQueueUrl,
    MessageBody: JSON.stringify({ task_id: taskId, cuit, sub, timestamp }),
  }));

  return { taskId, cuit, status: 'PROCESSING' };
}

module.exports = { enqueueEvaluation };
