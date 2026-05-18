'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const SIMULATIONS_TABLE = process.env.DYNAMODB_TABLE_NAME;
const PRODUCTO_TABLE = process.env.DYNAMODB_PRODUCTO_TABLE;

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'OPTIONS,GET',
};

function respond(statusCode, body) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(body) };
}

function rank(productos, scoreX10) {
  const elegibles = [];
  const no_elegibles = [];
  for (const p of productos) {
    const min = Number(p.min_score);
    const max = Number(p.max_score);
    const prioridad = Number(p.prioridad ?? 0);
    const base = { ...p, prioridad };
    if (scoreX10 >= min && scoreX10 <= max) {
      elegibles.push(base);
    } else {
      const motivo = scoreX10 < min
        ? `Score ${scoreX10.toFixed(2)} por debajo del mínimo ${min}`
        : `Score ${scoreX10.toFixed(2)} por encima del máximo ${max}`;
      no_elegibles.push({ ...base, motivo });
    }
  }
  const byPriority = (a, b) => b.prioridad - a.prioridad || String(a.nombre).localeCompare(String(b.nombre));
  elegibles.sort(byPriority);
  no_elegibles.sort(byPriority);
  return { elegibles, no_elegibles };
}

exports.handler = async (event) => {
  try {
    const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!sub) return respond(401, { error: 'Unauthorized' });

    const taskId = event.queryStringParameters?.task_id;
    if (!taskId) return respond(400, { error: 'Missing required query param: task_id' });

    const simResp = await docClient.send(new QueryCommand({
      TableName: SIMULATIONS_TABLE,
      KeyConditionExpression: '#sub = :sub',
      FilterExpression: 'task_id = :tid',
      ExpressionAttributeNames: { '#sub': 'sub' },
      ExpressionAttributeValues: { ':sub': sub, ':tid': taskId },
    }));

    if (!simResp.Items || simResp.Items.length === 0) {
      return respond(404, { error: 'Simulation not found' });
    }
    const simulation = simResp.Items[0];

    const baseCliente = {
      cuit: simulation.cuit,
      status: simulation.status,
      score: null,
      score_x10: null,
      rejection_reasons: simulation.rejection_reasons || [],
      error_message: simulation.error_message || null,
    };

    if (simulation.status !== 'COMPLETED' || simulation.score === undefined || simulation.score === null) {
      return respond(200, { cliente: baseCliente, elegibles: [], no_elegibles: [] });
    }

    const prodResp = await docClient.send(new QueryCommand({
      TableName: PRODUCTO_TABLE,
      KeyConditionExpression: '#sub = :sub',
      ExpressionAttributeNames: { '#sub': 'sub' },
      ExpressionAttributeValues: { ':sub': sub },
    }));

    const productos = prodResp.Items || [];
    const score = Number(simulation.score);
    const scoreX10 = score * 10;
    const { elegibles, no_elegibles } = rank(productos, scoreX10);

    return respond(200, {
      cliente: { ...baseCliente, score, score_x10: scoreX10 },
      elegibles,
      no_elegibles,
    });
  } catch (err) {
    console.error('Error en recommendations-get:', err);
    return respond(500, { error: 'Internal server error', message: err.message });
  }
};
