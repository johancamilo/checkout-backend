import { Inject, Injectable } from '@nestjs/common';
import { GetCommand, PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { TransactionRepository } from '@domain/ports/repositories.port';
import { Transaction } from '@domain/entities/transaction.entity';
import { AppConfig } from '@config/app.config';
import { DYNAMODB_DOCUMENT_CLIENT } from './dynamodb-client.provider';

@Injectable()
export class DynamoDBTransactionRepository implements TransactionRepository {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT) private readonly client: DynamoDBDocumentClient,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {
    this.tableName = config.aws.dynamodb.transactionsTable;
  }

  async findById(id: string): Promise<Transaction | null> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    if (!result.Item) return null;
    return Transaction.fromPersistence({
      id: result.Item.id,
      productId: result.Item.productId,
      customerId: result.Item.customerId,
      quantity: result.Item.quantity,
      productAmountInCents: result.Item.productAmountInCents,
      baseFeeInCents: result.Item.baseFeeInCents,
      deliveryFeeInCents: result.Item.deliveryFeeInCents,
      status: result.Item.status,
      gatewayTransactionId: result.Item.gatewayTransactionId,
      gatewayPaymentStatus: result.Item.gatewayPaymentStatus,
      createdAt: new Date(result.Item.createdAt),
      updatedAt: new Date(result.Item.updatedAt),
    });
  }

  async save(transaction: Transaction): Promise<void> {
    const primitives = transaction.toPrimitives();
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          ...primitives,
          createdAt: primitives.createdAt.toISOString(),
          updatedAt: primitives.updatedAt.toISOString(),
        },
      }),
    );
  }
}
