'use strict';

const { enqueueEvaluation } = require('./shared/enqueue');

const QUEUE_URL         = process.env.SQS_QUEUE_URL;
const SIMULATIONS_TABLE = process.env.DYNAMODB_TABLE_NAME;
const USER_TABLE        = process.env.DYNAMODB_USER_TABLE;

const HEADERS = { 'Content-Type': 'application/json' };

function respond(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  try {
    const fintechSub = event.requestContext?.authorizer?.lambda?.fintech_sub;
    if (!fintechSub) return respond(401, { error: 'No autorizado' });

    let parsed;
    try {
      parsed = JSON.parse(event.body);
    } catch {
      return respond(400, { error: 'JSON inválido en el body' });
    }

    const { cuit } = parsed;
    if (!cuit) return respond(400, { error: "Falta 'cuit' en el body" });

    const { taskId, status } = await enqueueEvaluation({
      sub: fintechSub, cuit,
      simulationsTable: SIMULATIONS_TABLE,
      userTable: USER_TABLE,
      sqsQueueUrl: QUEUE_URL,
    });

    return respond(202, { task_id: taskId, cuit, status });
  } catch (err) {
    console.error('Error in b2b-evaluations:', err);
    return respond(500, { error: 'Error interno del servidor', message: err.message });
  }
};
