const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { runner } = require('node-pg-migrate');
const { Client } = require('pg');
const path = require('path');

const smClient = new SecretsManagerClient({ region: 'us-east-1' });

async function runSmokeTest(dbConfig) {
  const client = new Client(dbConfig);
  await client.connect();
  try {
    const insert = await client.query(
      `INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id`,
      ['__smoke_test__', '__smoke_test__@test.internal', '__smoke_test__']
    );
    const id = insert.rows[0].id;

    await client.query(`UPDATE users SET name = $1 WHERE id = $2`, ['__smoke_test_updated__', id]);

    const updated = await client.query(`SELECT name FROM users WHERE id = $1`, [id]);
    if (updated.rows[0].name !== '__smoke_test_updated__') {
      throw new Error('Smoke test: UPDATE did not persist');
    }

    await client.query(`DELETE FROM users WHERE id = $1`, [id]);

    const remaining = await client.query(`SELECT id FROM users WHERE id = $1`, [id]);
    if (remaining.rows.length !== 0) {
      throw new Error('Smoke test: DELETE did not remove the row');
    }

    console.log('Smoke test passed: INSERT, UPDATE, DELETE OK');
  } finally {
    await client.end();
  }
}

exports.handler = async () => {
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

  await runner({
    databaseUrl: dbConfig,
    dir: path.join(__dirname, 'migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    log: console.log,
  });

  await runSmokeTest(dbConfig);

  return { statusCode: 200 };
};
