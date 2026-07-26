/**
 * Seeds the Products table with dummy products.
 * Run with: npm run seed
 *
 * Safe to run against DynamoDB Local (for development) or a real AWS
 * DynamoDB table (for the deployed environment) - just point DYNAMODB_ENDPOINT
 * and table name env vars accordingly before running.
 */
import 'reflect-metadata';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { loadConfig } from '@config/app.config';
import { createDynamoDBDocumentClient } from './dynamodb-client.provider';

const DUMMY_PRODUCTS = [
  {
    id: 'prod-001',
    name: 'Wireless Mechanical Keyboard',
    description: 'Compact 65% mechanical keyboard with hot-swappable switches.',
    priceInCents: 25000000, // $250.000 COP
    stock: 15,
    imageUrl: 'https://placehold.co/600x400/1a1a2e/ffffff/png?text=Mechanical+Keyboard',
  },
  {
    id: 'prod-002',
    name: 'Noise Cancelling Headphones',
    description: 'Over-ear wireless headphones with active noise cancellation.',
    priceInCents: 45000000, // $450.000 COP
    stock: 8,
    imageUrl: 'https://placehold.co/600x400/2e2e4d/ffffff/png?text=Headphones',
  },
  {
    id: 'prod-003',
    name: '4K Webcam',
    description: 'Ultra HD webcam with auto-focus, ideal for streaming.',
    priceInCents: 18000000, // $180.000 COP
    stock: 20,
    imageUrl: 'https://placehold.co/600x400/1a1a2e/ffffff/png?text=4K+Webcam',
  },
  {
    id: 'prod-004',
    name: 'Portable Bluetooth Speaker',
    description: 'Compact waterproof speaker with 12-hour battery life.',
    priceInCents: 12000000, // $120.000 COP
    stock: 25,
    imageUrl: 'https://placehold.co/600x400/2e2e4d/ffffff/png?text=Bluetooth+Speaker',
  },
  {
    id: 'prod-005',
    name: 'Smart Fitness Watch',
    description: 'Fitness tracker with heart rate monitor and GPS.',
    priceInCents: 32000000, // $320.000 COP
    stock: 12,
    imageUrl: 'https://placehold.co/600x400/1a1a2e/ffffff/png?text=Fitness+Watch',
  },
  {
    id: 'prod-006',
    name: 'USB-C Hub Adapter',
    description: '7-in-1 USB-C hub with HDMI, SD card reader, and fast charging.',
    priceInCents: 9500000, // $95.000 COP
    stock: 30,
    imageUrl: 'https://placehold.co/600x400/2e2e4d/ffffff/png?text=USB-C+Hub',
  },
];

async function seed() {
  const config = loadConfig();
  const client = createDynamoDBDocumentClient(config);

  for (const product of DUMMY_PRODUCTS) {
    await client.send(
      new PutCommand({ TableName: config.aws.dynamodb.productsTable, Item: product }),
    );
    // eslint-disable-next-line no-console
    console.log(`Seeded product: ${product.id} - ${product.name}`);
  }

  // eslint-disable-next-line no-console
  console.log('Seed completed.');
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
