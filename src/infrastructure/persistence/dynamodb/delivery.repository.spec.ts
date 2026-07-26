import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBDeliveryRepository } from './delivery.repository';
import { Delivery } from '@domain/entities/delivery.entity';
import { AppConfig } from '@config/app.config';

describe('DynamoDBDeliveryRepository', () => {
  let client: { send: jest.Mock };
  let repository: DynamoDBDeliveryRepository;
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
    repository = new DynamoDBDeliveryRepository(client as any, config);
  });

  describe('findByTransactionId', () => {
    it('returns null when the item does not exist', async () => {
      client.send.mockResolvedValue({});

      const result = await repository.findByTransactionId('txn-404');

      expect(result).toBeNull();
      const sentCommand = client.send.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(GetCommand);
      expect(sentCommand.input).toEqual({
        TableName: 'Deliveries',
        Key: { transactionId: 'txn-404' },
      });
    });

    it('maps a stored item back into a Delivery entity', async () => {
      client.send.mockResolvedValue({
        Item: {
          id: 'del-1',
          transactionId: 'txn-1',
          addressLine: 'Calle 123 #45-67',
          city: 'Bogotá',
          region: 'Cundinamarca',
          feeInCents: 200000,
        },
      });

      const delivery = await repository.findByTransactionId('txn-1');

      expect(delivery).toBeInstanceOf(Delivery);
      expect(delivery?.city).toBe('Bogotá');
    });

    it('throws when the stored record is corrupted', async () => {
      client.send.mockResolvedValue({
        Item: {
          id: 'del-bad',
          transactionId: 'txn-1',
          addressLine: 'a',
          city: '',
          region: '',
          feeInCents: -1,
        },
      });

      await expect(repository.findByTransactionId('txn-1')).rejects.toThrow(
        /Corrupted delivery record/,
      );
    });
  });

  describe('save', () => {
    it('persists the delivery primitives with a PutCommand', async () => {
      const delivery = Delivery.create({
        id: 'del-1',
        transactionId: 'txn-1',
        addressLine: 'Calle 123 #45-67',
        city: 'Bogotá',
        region: 'Cundinamarca',
        feeInCents: 200000,
      }).value;
      client.send.mockResolvedValue({});

      await repository.save(delivery);

      const sentCommand = client.send.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(PutCommand);
      expect(sentCommand.input).toEqual({
        TableName: 'Deliveries',
        Item: delivery.toPrimitives(),
      });
    });
  });
});
