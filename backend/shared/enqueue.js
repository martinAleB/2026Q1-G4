'use strict';

const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const sqs = new SQSClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * Encola una evaluación crediticia para un CUIT dado.
 * Persiste user-cuit en DynamoDB y el registro de simulación, luego envía a SQS.
 * El portfolio tracking (portfolio_cuits + portfolio_tracking) lo escribe el engine
 * en RDS cuando procesa el mensaje.
 *
 * @param {object} p
 * @param {string} p.sub            sub del fintech (de JWT o del Lambda Authorizer B2B)
 * @param {string} p.cuit           CUIT a evaluar
 * @param {string} p.simulationsTable
 * @param {string} p.userTable
 * @param {string} p.sqsQueueUrl
 * @returns {{ taskId: string, cuit: string, status: 'PROCESSING' }}
 */
async function enqueueEvaluation({ sub, cuit, simulationsTable, userTable, sqsQueueUrl }) {
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
