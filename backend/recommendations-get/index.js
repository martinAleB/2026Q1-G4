'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const SIMULATIONS_TABLE = process.env.DYNAMODB_TABLE_NAME;
const PRODUCT_TABLE = process.env.DYNAMODB_PRODUCT_TABLE;

// Headers CORS los inyecta API Gateway (cors_configuration en api-gateway.tf);
// si los devolvemos desde el Lambda pisan la config del gateway.
const HEADERS = { 'Content-Type': 'application/json' };

function respond(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

function rank(products, scoreX10) {
  const eligible = [];
  const not_eligible = [];
  for (const p of products) {
    const min = Number(p.min_score);
    const max = Number(p.max_score);
    const priority = Number(p.priority ?? 0);
    const base = { ...p, priority };
    if (scoreX10 >= min && scoreX10 <= max) {
      eligible.push(base);
    } else {
      const reason = scoreX10 < min
        ? `Score ${scoreX10.toFixed(2)} por debajo del mínimo ${min}`
        : `Score ${scoreX10.toFixed(2)} por encima del máximo ${max}`;
      not_eligible.push({ ...base, reason });
    }
  }
  const byPriority = (a, b) => b.priority - a.priority || String(a.name).localeCompare(String(b.name));
  eligible.sort(byPriority);
  not_eligible.sort(byPriority);
  return { eligible, not_eligible };
}

exports.handler = async (event) => {
  try {
    const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!sub) return respond(401, { error: 'No autorizado' });

    const taskId = event.queryStringParameters?.task_id;
    if (!taskId) return respond(400, { error: 'Falta el query param: task_id' });

    // Lookup via GSI task-id-sub-index: 1 RCU para encontrar el item exacto
    // y validar tenant ownership en la misma KeyCondition. Reemplaza el
    // patrón anterior (Query por sub + FilterExpression task_id) que cobraba
    // RCUs por todas las simulaciones de la fintech antes de filtrar.
    const simResp = await docClient.send(new QueryCommand({
      TableName: SIMULATIONS_TABLE,
      IndexName: 'task-id-sub-index',
      KeyConditionExpression: 'task_id = :tid AND #sub = :sub',
      ExpressionAttributeNames: { '#sub': 'sub' },
      ExpressionAttributeValues: { ':sub': sub, ':tid': taskId },
    }));

    if (!simResp.Items || simResp.Items.length === 0) {
      return respond(404, { error: 'Simulación no encontrada' });
    }
    const simulation = simResp.Items[0];

    const baseClient = {
      cuit: simulation.cuit,
      status: simulation.status,
      score: null,
      score_x10: null,
      rejection_reasons: simulation.rejection_reasons || [],
      error_message: simulation.error_message || null,
    };

    if (simulation.status !== 'COMPLETED' || simulation.score === undefined || simulation.score === null) {
      return respond(200, { client: baseClient, eligible: [], not_eligible: [] });
    }

    const prodResp = await docClient.send(new QueryCommand({
      TableName: PRODUCT_TABLE,
      KeyConditionExpression: '#sub = :sub',
      ExpressionAttributeNames: { '#sub': 'sub' },
      ExpressionAttributeValues: { ':sub': sub },
    }));

    const products = prodResp.Items || [];
    const score = Number(simulation.score);
    const scoreX10 = score * 10;
    const { eligible, not_eligible } = rank(products, scoreX10);

    return respond(200, {
      client: { ...baseClient, score, score_x10: scoreX10 },
      eligible,
      not_eligible,
    });
  } catch (err) {
    console.error('Error in recommendations-get:', err);
    return respond(500, { error: 'Error interno del servidor', message: err.message });
  }
};
