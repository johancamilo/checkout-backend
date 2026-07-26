import { Inject, Injectable } from '@nestjs/common';
import { GetCommand, PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ProductRepository } from '@domain/ports/repositories.port';
import { Product } from '@domain/entities/product.entity';
import { AppConfig } from '@config/app.config';
import { DYNAMODB_DOCUMENT_CLIENT } from './dynamodb-client.provider';

@Injectable()
export class DynamoDBProductRepository implements ProductRepository {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT) private readonly client: DynamoDBDocumentClient,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {
    this.tableName = config.aws.dynamodb.productsTable;
  }

  async findById(id: string): Promise<Product | null> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    if (!result.Item) return null;
    const created = Product.create({
      id: result.Item.id,
      name: result.Item.name,
      description: result.Item.description,
      priceInCents: result.Item.priceInCents,
      stock: result.Item.stock,
      imageUrl: result.Item.imageUrl,
    });
    // Data coming from our own DB is trusted; if it fails validation here it
    // means the stored data is corrupted, which we surface loudly.
    if (created.isFailure) {
      throw new Error(`Corrupted product record ${id}: ${created.error.message}`);
    }
    return created.value;
  }

  async save(product: Product): Promise<void> {
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: product.toPrimitives() }),
    );
  }
}
