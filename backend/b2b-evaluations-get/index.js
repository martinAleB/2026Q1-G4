'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const SIMULATIONS_TABLE = process.env.DYNAMODB_TABLE_NAME;
const PRODUCT_TABLE     = process.env.DYNAMODB_PRODUCT_TABLE;

const HEADERS = { 'Content-Type': 'application/json' };

function respond(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

function getEligibleProducts(products, scoreX10) {
  return products
    .filter(p => scoreX10 >= Number(p.min_score) && scoreX10 <= Number(p.max_score))
    .map(({ sub, product_id, min_score, max_score, ...rest }) => ({ ...rest, priority: Number(rest.priority ?? 0) }))
    .sort((a, b) => b.priority - a.priority || String(a.name).localeCompare(String(b.name)));
}

async function fetchProducts(fintechSub) {
  if (!PRODUCT_TABLE) return [];
  const result = await ddb.send(new QueryCommand({
    TableName: PRODUCT_TABLE,
    KeyConditionExpression: '#sub = :sub',
    ExpressionAttributeNames: { '#sub': 'sub' },
    ExpressionAttributeValues: { ':sub': fintechSub },
  }));
  return result.Items ?? [];
}

function buildEvaluation(item, products) {
  const base = {
    task_id: item.task_id,
    cuit: item.cuit,
    status: item.status,
    score: item.score !== undefined && item.score !== null ? Number(item.score) : null,
    created_at: item.created_at,
    rejection_reasons: item.rejection_reasons ?? [],
    error_message: item.error_message ?? null,
    recommended_products: [],
  };

  if (item.status === 'COMPLETED' && item.score !== undefined && item.score !== null) {
    base.recommended_products = getEligibleProducts(products, Number(item.score) * 10);
  }

  return base;
}

exports.handler = async (event) => {
  try {
    const fintechSub = event.requestContext?.authorizer?.lambda?.fintech_sub;
    if (!fintechSub) return respond(401, { error: 'No autorizado' });

    const { task_id, cuit: cuitFilter } = event.queryStringParameters ?? {};

    if (task_id) {
      const result = await ddb.send(new QueryCommand({
        TableName: SIMULATIONS_TABLE,
        IndexName: 'task-id-sub-index',
        KeyConditionExpression: 'task_id = :tid AND #sub = :sub',
        ExpressionAttributeNames: { '#sub': 'sub' },
        ExpressionAttributeValues: { ':tid': task_id, ':sub': fintechSub },
      }));

      if (!result.Items || result.Items.length === 0) {
        return respond(404, { error: 'Evaluación no encontrada' });
      }

      const item = result.Items[0];
      const products = await fetchProducts(fintechSub);
      return respond(200, { evaluation: buildEvaluation(item, products) });
    }

    const queryParams = {
      TableName: SIMULATIONS_TABLE,
      KeyConditionExpression: '#sub = :sub',
      ExpressionAttributeNames: { '#sub': 'sub' },
      ExpressionAttributeValues: { ':sub': fintechSub },
    };

    if (cuitFilter) {
      queryParams.KeyConditionExpression += ' AND begins_with(sk, :cuitPrefix)';
      queryParams.ExpressionAttributeValues[':cuitPrefix'] = `CUIT#${cuitFilter}#`;
    }

    const result = await ddb.send(new QueryCommand(queryParams));

    const byCuit = {};
    for (const item of (result.Items ?? [])) {
      if (!byCuit[item.cuit] || item.created_at > byCuit[item.cuit].created_at) {
        byCuit[item.cuit] = item;
      }
    }

    const items = Object.values(byCuit);
    const needsProducts = items.some(i => i.status === 'COMPLETED' && i.score != null);
    const products = needsProducts ? await fetchProducts(fintechSub) : [];

    return respond(200, { evaluations: items.map(item => buildEvaluation(item, products)) });
  } catch (err) {
    console.error('Error in b2b-evaluations-get:', err);
    return respond(500, { error: 'Error interno del servidor', message: err.message });
  }
};
