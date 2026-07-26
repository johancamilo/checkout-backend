import { Inject, Injectable } from '@nestjs/common';
import { GetCommand, PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { CustomerRepository } from '@domain/ports/repositories.port';
import { Customer } from '@domain/entities/customer.entity';
import { AppConfig } from '@config/app.config';
import { DYNAMODB_DOCUMENT_CLIENT } from './dynamodb-client.provider';

@Injectable()
export class DynamoDBCustomerRepository implements CustomerRepository {
  private readonly tableName: string;

  constructor(
    @Inject(DYNAMODB_DOCUMENT_CLIENT) private readonly client: DynamoDBDocumentClient,
    @Inject('APP_CONFIG') private readonly config: AppConfig,
  ) {
    this.tableName = config.aws.dynamodb.customersTable;
  }

  async findById(id: string): Promise<Customer | null> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { id } }),
    );
    if (!result.Item) return null;
    const created = Customer.create({
      id: result.Item.id,
      fullName: result.Item.fullName,
      email: result.Item.email,
      phoneNumber: result.Item.phoneNumber,
      documentNumber: result.Item.documentNumber,
    });
    if (created.isFailure) {
      throw new Error(`Corrupted customer record ${id}: ${created.error.message}`);
    }
    return created.value;
  }

  async save(customer: Customer): Promise<void> {
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: customer.toPrimitives() }),
    );
  }
}
