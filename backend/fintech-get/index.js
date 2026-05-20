'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.DYNAMODB_FINTECH_TABLE;

// Defaults espejados con fintech-post-confirmation. Si ese trigger falla
// (DLQ async) este Lambda los reaplica en el primer GET, así una fintech
// confirmada nunca queda sin fila. Si se modifican, actualizar también
// fintech-post-confirmation/index.js.
const DEFAULT_FINTECH_ROW = {
  fintech_name: 'Nueva Fintech',
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

exports.handler = async (event) => {

  const sub = event.requestContext?.authorizer?.jwt?.claims?.sub;
  if (!sub) return respond(401, { error: 'No autorizado' });

  try {
    const { Item } = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { sub },
    }));
    if (Item) return respond(200, Item);

    // Sin fila: probablemente el trigger post-confirmation falló. Seedeo con
    // defaults usando un Put condicional para que sea idempotente ante races
    // (dos GETs simultáneos no duplican ni se pisan). Email se toma del claim
    // si está en el id_token; con access_token suele no venir y queda undefined.
    const email = event.requestContext?.authorizer?.jwt?.claims?.email;
    const seedItem = { sub, ...(email ? { email } : {}), ...DEFAULT_FINTECH_ROW };

    try {
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: seedItem,
        ConditionExpression: 'attribute_not_exists(#sub)',
        ExpressionAttributeNames: { '#sub': 'sub' },
      }));
      console.log(`Seeded fintech row lazily for sub=${sub}`);
      return respond(200, seedItem);
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        // Otra invocación seedó primero — re-leemos para devolver el item real.
        const { Item: existing } = await ddb.send(new GetCommand({
          TableName: TABLE,
          Key: { sub },
        }));
        return respond(200, existing || seedItem);
      }
      throw err;
    }
  } catch (err) {
    console.error('Internal error:', err);
    return respond(500, { error: 'Error interno del servidor', message: err.message });
  }
};
