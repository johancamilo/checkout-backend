import 'dotenv/config';

export interface AppConfig {
  port: number;
  aws: {
    region: string;
    dynamodb: {
      endpoint?: string; // set for local DynamoDB; omit in real AWS
      productsTable: string;
      transactionsTable: string;
      customersTable: string;
      deliveriesTable: string;
    };
  };
  paymentGateway: {
    baseUrl: string;
    publicKey: string;
    privateKey: string;
    integritySecret: string;
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.PORT ?? 3000),
    aws: {
      region: process.env.AWS_REGION ?? 'us-east-1',
      dynamodb: {
        endpoint: process.env.DYNAMODB_ENDPOINT, // e.g. http://localhost:8000 for local dev
        productsTable: process.env.PRODUCTS_TABLE ?? 'Products',
        transactionsTable: process.env.TRANSACTIONS_TABLE ?? 'Transactions',
        customersTable: process.env.CUSTOMERS_TABLE ?? 'Customers',
        deliveriesTable: process.env.DELIVERIES_TABLE ?? 'Deliveries',
      },
    },
    paymentGateway: {
      baseUrl: requireEnv('PAYMENT_GATEWAY_BASE_LINK'),
      publicKey: requireEnv('PAYMENT_GATEWAY_PUBLIC_KEY'),
      privateKey: requireEnv('PAYMENT_GATEWAY_PRIVATE_KEY'),
      integritySecret: requireEnv('PAYMENT_GATEWAY_INTEGRITY_SECRET'),
    },
  };
}