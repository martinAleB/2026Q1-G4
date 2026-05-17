'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
const TABLE = process.env.DYNAMODB_FINTECH_TABLE;

exports.handler = async (event) => {
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') return event;

  const { sub, email } = event.request.userAttributes;

  await ddb.send(new PutCommand({ 
    TableName: TABLE, 
    Item: { 
      sub,
      email
    } 
  }));

  return event;
};
