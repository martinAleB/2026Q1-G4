const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { runner } = require('node-pg-migrate');
const path = require('path');

const smClient = new SecretsManagerClient({ region: 'us-east-1' });

exports.handler = async (event) => {
  const { SecretString } = await smClient.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRET_ARN })
  );
  const { username, password } = JSON.parse(SecretString);

  const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: username,
    password,
    ssl: { rejectUnauthorized: false },
  };

  const direction = event?.action === 'down' ? 'down' : 'up';

  await runner({
    databaseUrl: dbConfig,
    dir: path.join(__dirname, 'migrations'),
    direction,
    migrationsTable: 'pgmigrations',
    log: console.log,
  });

  return { statusCode: 200 };
};
