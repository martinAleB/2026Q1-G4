'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

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

function respond(statusCode, body) {
  return { statusCode, body: JSON.stringify(body) };
}

function isInt(value) {
  return typeof value === 'number' && Number.isInteger(value);
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

const VALIDATORS = {
  fintech_name: (v) => typeof v === 'string' && v.trim().length > 0
    ? null : 'El nombre de la fintech debe ser un string no vacío',
  max_situacion_crediticia: (v) => isInt(v) && v >= 1 && v <= 5
    ? null : 'max_situacion_crediticia debe ser un entero entre 1 y 5',
  max_entidades_con_deuda: (v) => isInt(v) && v >= 0
    ? null : 'max_entidades_con_deuda debe ser un entero >= 0',
  max_deuda_total_ars: (v) => isNumber(v) && v >= 0
    ? null : 'max_deuda_total_ars debe ser un número >= 0',
  min_meses_situacion_1: (v) => isInt(v) && v >= 0 && v <= 24
    ? null : 'min_meses_situacion_1 debe ser un entero entre 0 y 24',
  max_dias_atraso: (v) => isInt(v) && v >= 0
    ? null : 'max_dias_atraso debe ser un entero >= 0',
  permite_proceso_judicial: (v) => typeof v === 'boolean'
    ? null : 'permite_proceso_judicial debe ser un booleano',
};

const ALLOWED_FIELDS = Object.keys(VALIDATORS);

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  try {
    const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!sub) return respond(401, { error: 'No autorizado' });

    const body = JSON.parse(event.body || '{}');
    const updates = {};
    const errors = {};

    for (const field of ALLOWED_FIELDS) {
      if (body[field] === undefined) continue;
      const err = VALIDATORS[field](body[field]);
      if (err) errors[field] = err;
      else updates[field] = body[field];
    }

    if (Object.keys(errors).length > 0) {
      return respond(400, { error: 'Datos inválidos', detalles: errors });
    }

    if (Object.keys(updates).length === 0) {
      return respond(400, { error: 'No se enviaron campos válidos para actualizar' });
    }

    // Check if the item already exists in DynamoDB
    const { Item } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { sub },
    }));

    let resultAttributes;

    if (!Item) {
      const email = event.requestContext?.authorizer?.jwt?.claims?.email;
      const newItem = {
        sub,
        ...(email ? { email } : {}),
        ...DEFAULT_FINTECH_ROW,
        ...updates
      };
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: newItem,
      }));
      resultAttributes = newItem;
      console.log(`Created new fintech row with defaults for sub=${sub}`);
    } else {
      const setParts = [];
      const names = {};
      const values = {};
      Object.entries(updates).forEach(([key, val], i) => {
        const n = `#k${i}`;
        const v = `:v${i}`;
        setParts.push(`${n} = ${v}`);
        names[n] = key;
        values[v] = val;
      });

      const { Attributes } = await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { sub },
        UpdateExpression: `SET ${setParts.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: 'ALL_NEW',
      }));
      resultAttributes = Attributes;
      console.log(`Updated existing fintech row for sub=${sub}`);
    }

    return respond(200, resultAttributes);
  } catch (error) {
    console.error('Error:', error);
    return respond(500, { error: 'Error interno del servidor', message: error.message });
  }
};
