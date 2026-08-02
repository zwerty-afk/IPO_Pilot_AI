/**
 * Creates the DynamoDB table backing the app.
 *
 * Design note: the existing db.js treats the database as one JSON document that is
 * read whole and written whole. Rather than shattering that into a dozen tables and
 * rewriting every call site in server.js, we keep a single table keyed by a logical
 * collection name. Each top-level collection ("users", "documents", "intake", ...)
 * is one item. This preserves the current access pattern exactly while making the
 * storage real, durable and shared across machines.
 *
 *   pk (S)  = collection name, e.g. "users" | "documents" | "intake"
 *
 * Run: node scripts/create-tables.mjs
 */
import 'dotenv/config';
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists
} from '@aws-sdk/client-dynamodb';

const REGION = process.env.AWS_REGION || 'ap-south-1';
const TABLE = process.env.DYNAMO_TABLE || 'ipo_pilot_data';

const client = new DynamoDBClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function exists(name) {
  try {
    await client.send(new DescribeTableCommand({ TableName: name }));
    return true;
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return false;
    throw err;
  }
}

async function main() {
  console.log(`region=${REGION} table=${TABLE}`);

  if (await exists(TABLE)) {
    console.log(`Table "${TABLE}" already exists — nothing to do.`);
    return;
  }

  console.log(`Creating table "${TABLE}"...`);
  await client.send(new CreateTableCommand({
    TableName: TABLE,
    BillingMode: 'PAY_PER_REQUEST', // no capacity planning, scales to zero cost when idle
    KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'pk', AttributeType: 'S' }]
  }));

  await waitUntilTableExists({ client, maxWaitTime: 120 }, { TableName: TABLE });
  console.log(`Table "${TABLE}" is ACTIVE.`);
}

main().catch((err) => {
  console.error('FAILED:', err.name, '-', err.message);
  process.exit(1);
});
