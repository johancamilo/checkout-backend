import { Inject, Injectable } from '@nestjs/common';
import { GetCommand, PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DeliveryRepository } from '@domain/ports/repositories.port';
import { Delivery } from '@domain/entities/delivery.entity';
import { AppConfig } from '@config/app.config';
import { DYNAMODB_DOCUMENT_CLIENT } from './dynamodb-client.provider';

/**
 * Deliveries have a 1:1 relationship with a Transaction, so the table uses
 * transactionId as the partition key directly (no GSI/query needed to look
 * up a delivery by its transaction).
 */
@Injectable()
export class DynamoDBDeliveryRepository implements DeliveryRepository {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT) private readonly client: DynamoDBDocumentClient,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {
    this.tableName = config.aws.dynamodb.deliveriesTable;
  }

  async findByTransactionId(transactionId: string): Promise<Delivery | null> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { transactionId } }),
    );
    if (!result.Item) return null;
    const created = Delivery.create({
      id: result.Item.id,
      transactionId: result.Item.transactionId,
      addressLine: result.Item.addressLine,
      city: result.Item.city,
      region: result.Item.region,
      postalCode: result.Item.postalCode,
      feeInCents: result.Item.feeInCents,
    });
    if (created.isFailure) {
      throw new Error(
        `Corrupted delivery record for transaction ${transactionId}: ${created.error.message}`,
      );
    }
    return created.value;
  }

  async save(delivery: Delivery): Promise<void> {
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: delivery.toPrimitives() }),
    );
  }
}
