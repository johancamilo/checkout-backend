import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBProductRepository } from './product.repository';
import { Product } from '@domain/entities/product.entity';
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
});
