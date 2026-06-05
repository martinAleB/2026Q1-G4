'use strict';

const { createHash } = require('crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const API_CLIENTS_TABLE = process.env.DYNAMODB_API_CLIENTS_TABLE;

// API key format: presti_live_<api_key_id(8)><secret(32)>
// prefix length = "presti_live_".length = 12
const PREFIX = 'presti_live_';
const KEY_ID_LENGTH = 8;
const TOTAL_MIN_LENGTH = PREFIX.length + KEY_ID_LENGTH + 1;

exports.handler = async (event) => {
  try {
    const authHeader = event.headers?.authorization ?? event.headers?.Authorization ?? '';
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!apiKey || !apiKey.startsWith(PREFIX) || apiKey.length < TOTAL_MIN_LENGTH) {
      return { isAuthorized: false };
    }

    const apiKeyId = apiKey.slice(PREFIX.length, PREFIX.length + KEY_ID_LENGTH);
    const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

    const result = await ddb.send(new GetCommand({
      TableName: API_CLIENTS_TABLE,
      Key: { api_key_id: apiKeyId },
    }));

    const item = result.Item;
    if (!item || item.active !== true || item.api_key_hash !== apiKeyHash) {
      console.log('API key invalid or inactive:', apiKeyId);
      return { isAuthorized: false };
    }

    return {
      isAuthorized: true,
      context: { fintech_sub: item.fintech_sub },
    };
  } catch (err) {
    console.error('Authorizer internal error:', err);
    return { isAuthorized: false };
  }
};
