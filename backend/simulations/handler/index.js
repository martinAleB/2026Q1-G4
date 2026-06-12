'use strict';

const { enqueueEvaluation } = require('./shared/enqueue');

const QUEUE_URL         = process.env.SQS_QUEUE_URL;
const SIMULATIONS_TABLE = process.env.DYNAMODB_TABLE_NAME;
const USER_TABLE        = process.env.DYNAMODB_USER_TABLE;

const headers = { 'Content-Type': 'application/json' };

exports.handler = async (event) => {
  try {
    const method = event.requestContext?.http?.method || event.httpMethod;

    if (method !== 'POST') {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Ruta no encontrada o método no permitido' }) };
    }

    if (!event.body) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta el body' }) };
    }

    let parsed;
    try {
      parsed = JSON.parse(event.body);
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON inválido en el body' }) };
    }

    const { cuit } = parsed;
    if (!cuit) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Falta 'cuit' en el body" }) };
    }

    const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!sub) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'No se pudo obtener el sub del token' }) };
    }

    if (!SIMULATIONS_TABLE || !USER_TABLE) {
      console.error('Required DynamoDB table env vars are not set');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuración interna incompleta (DynamoDB)' }) };
    }

    if (!QUEUE_URL) {
      console.error('SQS_QUEUE_URL is not set');
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Configuración interna incompleta (SQS)' }) };
    }

    const { taskId, status } = await enqueueEvaluation({
      sub, cuit,
      simulationsTable: SIMULATIONS_TABLE,
      userTable: USER_TABLE,
      sqsQueueUrl: QUEUE_URL,
    });

    return {
      statusCode: 202,
      headers,
      body: JSON.stringify({ message: 'Simulación iniciada', task_id: taskId, status }),
    };
  } catch (err) {
    console.error('API error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno del servidor', message: err.message }) };
  }
};
