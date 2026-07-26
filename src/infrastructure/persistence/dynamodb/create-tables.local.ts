/**
 * Creates the DynamoDB tables for local development (DynamoDB Local).
 * NOT needed against real AWS - there, tables are created by the CDK stack
 * (see /infra). Run with: npx ts-node -r tsconfig-paths/register src/infrastructure/persistence/dynamodb/create-tables.local.ts
 */
import 'reflect-metadata';
import { DynamoDBClient, CreateTableCommand, ResourceInUseException } from '@aws-sdk/client-dynamodb';
import { loadConfig } from '@config/app.config';

async function createTableIfNotExists(
  client: DynamoDBClient,
  tableName: string,
  partitionKey: string,
) {
  try {
    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [{ AttributeName: partitionKey, AttributeType: 'S' }],
        KeySchema: [{ AttributeName: partitionKey, KeyType: 'HASH' }],
      }),
    );
    // eslint-disable-next-line no-console
    console.log(`Created table ${tableName}`);
  } catch (err) {
    if (err instanceof ResourceInUseException) {
      // eslint-disable-next-line no-console
      console.log(`Table ${tableName} already exists, skipping.`);
      return;
    }
    throw err;
  }
}

async function main() {
  const config = loadConfig();
  const client = new DynamoDBClient({
    region: config.aws.region,
    ...(config.aws.dynamodb.endpoint ? { endpoint: config.aws.dynamodb.endpoint } : {}),
  });

  await createTableIfNotExists(client, config.aws.dynamodb.productsTable, 'id');
  await createTableIfNotExists(client, config.aws.dynamodb.transactionsTable, 'id');
  await createTableIfNotExists(client, config.aws.dynamodb.customersTable, 'id');
  await createTableIfNotExists(client, config.aws.dynamodb.deliveriesTable, 'transactionId');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to create local tables:', err);
  process.exit(1);
});
