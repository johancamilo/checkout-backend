import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { AppConfig } from '@config/app.config';

export const DYNAMODB_DOCUMENT_CLIENT = Symbol('DYNAMODB_DOCUMENT_CLIENT');

export function createDynamoDBDocumentClient(config: AppConfig): DynamoDBDocumentClient {
  const client = new DynamoDBClient({
    region: config.aws.region,
    // Only set for local DynamoDB (e.g. docker run amazon/dynamodb-local).
    // In real AWS this stays undefined and the SDK resolves the real endpoint.
    ...(config.aws.dynamodb.endpoint ? { endpoint: config.aws.dynamodb.endpoint } : {}),
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}
