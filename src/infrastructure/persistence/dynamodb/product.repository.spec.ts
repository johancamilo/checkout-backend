import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBProductRepository } from './product.repository';
import { Product } from '@domain/entities/product.entity';
import { InsufficientStockPersistenceError } from '@domain/ports/repositories.port';
import { AppConfig } from '@config/app.config';

describe('DynamoDBProductRepository', () => {
  let client: { send: jest.Mock };
  let repository: DynamoDBProductRepository;
  const config: AppConfig = {
    port: 3000,
    aws: {
      region: 'us-east-1',
      dynamodb: {
        productsTable: 'Products',
        transactionsTable: 'Transactions',
        customersTable: 'Customers',
        deliveriesTable: 'Deliveries',
      },
    },
    paymentGateway: {
      baseUrl: 'https://api-sandbox.example.dev/v1',
      publicKey: 'pub',
      privateKey: 'prv',
      integritySecret: 'secret',
    },
  };

  beforeEach(() => {
    client = { send: jest.fn() };
    repository = new DynamoDBProductRepository(client as any, config);
  });

  describe('findById', () => {
    it('returns null when the item does not exist', async () => {
      client.send.mockResolvedValue({});

      const result = await repository.findById('prod-404');

      expect(result).toBeNull();
      const sentCommand = client.send.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(GetCommand);
      expect(sentCommand.input).toEqual({
        TableName: 'Products',
        Key: { id: 'prod-404' },
      });
    });

    it('maps a stored item back into a Product entity', async () => {
      client.send.mockResolvedValue({
        Item: {
          id: 'prod-002',
          name: 'Headphones',
          description: 'Noise cancelling',
          priceInCents: 45000000,
          stock: 8,
          imageUrl: 'https://placehold.co/600x400',
        },
      });

      const product = await repository.findById('prod-002');

      expect(product).toBeInstanceOf(Product);
      expect(product?.name).toBe('Headphones');
      expect(product?.stock).toBe(8);
    });

    it('throws when the stored record is corrupted', async () => {
      client.send.mockResolvedValue({
        Item: { id: 'prod-bad', name: '', description: '', priceInCents: -1, stock: -1 },
      });

      await expect(repository.findById('prod-bad')).rejects.toThrow(/Corrupted product record/);
    });
  });

  describe('save', () => {
    it('persists the product primitives with a PutCommand', async () => {
      const product = Product.create({
        id: 'prod-002',
        name: 'Headphones',
        description: 'Noise cancelling',
        priceInCents: 45000000,
        stock: 7,
      }).value;
      client.send.mockResolvedValue({});

      await repository.save(product);

      const sentCommand = client.send.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(PutCommand);
      expect(sentCommand.input).toEqual({
        TableName: 'Products',
        Item: product.toPrimitives(),
      });
    });
  });

  describe('decreaseStock', () => {
    it('sends an atomic conditional UpdateCommand and returns the updated product', async () => {
      client.send.mockResolvedValue({
        Attributes: {
          id: 'prod-002',
          name: 'Headphones',
          description: 'Noise cancelling',
          priceInCents: 45000000,
          stock: 7,
        },
      });

      const updated = await repository.decreaseStock('prod-002', 1);

      const sentCommand = client.send.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(UpdateCommand);
      expect(sentCommand.input).toEqual({
        TableName: 'Products',
        Key: { id: 'prod-002' },
        UpdateExpression: 'SET stock = stock - :quantity',
        ConditionExpression: 'attribute_exists(id) AND stock >= :quantity',
        ExpressionAttributeValues: { ':quantity': 1 },
        ReturnValues: 'ALL_NEW',
      });
      expect(updated).toBeInstanceOf(Product);
      expect(updated.stock).toBe(7);
    });

    it('throws InsufficientStockPersistenceError when the condition fails (race lost, or product missing)', async () => {
      client.send.mockRejectedValue(
        new ConditionalCheckFailedException({ message: 'condition failed', $metadata: {} }),
      );

      await expect(repository.decreaseStock('prod-002', 5)).rejects.toThrow(
        InsufficientStockPersistenceError,
      );
    });

    it('rethrows unexpected errors as-is', async () => {
      client.send.mockRejectedValue(new Error('DynamoDB is unavailable'));

      await expect(repository.decreaseStock('prod-002', 1)).rejects.toThrow(
        'DynamoDB is unavailable',
      );
    });

    it('throws when the updated record is corrupted', async () => {
      client.send.mockResolvedValue({
        Attributes: { id: 'prod-002', name: '', description: '', priceInCents: -1, stock: -1 },
      });

      await expect(repository.decreaseStock('prod-002', 1)).rejects.toThrow(
        /Corrupted product record/,
      );
    });
  });
});