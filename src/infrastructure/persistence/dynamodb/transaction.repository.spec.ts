import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBTransactionRepository } from './transaction.repository';
import { Transaction, TransactionStatus } from '@domain/entities/transaction.entity';
import { AppConfig } from '@config/app.config';

describe('DynamoDBTransactionRepository', () => {
  let client: { send: jest.Mock };
  let repository: DynamoDBTransactionRepository;
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
    repository = new DynamoDBTransactionRepository(client as any, config);
  });

  describe('findById', () => {
    it('returns null when the item does not exist', async () => {
      client.send.mockResolvedValue({});

      const result = await repository.findById('txn-404');

      expect(result).toBeNull();
      expect(client.send.mock.calls[0][0]).toBeInstanceOf(GetCommand);
    });

    it('maps a stored item back into a Transaction entity', async () => {
      client.send.mockResolvedValue({
        Item: {
          id: 'txn-1',
          productId: 'prod-002',
          customerId: 'cust-1',
          quantity: 1,
          productAmountInCents: 45000000,
          baseFeeInCents: 500000,
          deliveryFeeInCents: 200000,
          status: TransactionStatus.PENDING,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      });

      const transaction = await repository.findById('txn-1');

      expect(transaction).toBeInstanceOf(Transaction);
      expect(transaction?.status).toBe(TransactionStatus.PENDING);
      expect(transaction?.toPrimitives().createdAt).toBeInstanceOf(Date);
    });
  });

  describe('save', () => {
    it('persists the transaction with dates serialized as ISO strings', async () => {
      const transaction = Transaction.create({
        id: 'txn-1',
        productId: 'prod-002',
        customerId: 'cust-1',
        quantity: 1,
        productAmountInCents: 45000000,
        baseFeeInCents: 500000,
        deliveryFeeInCents: 200000,
      }).value;
      client.send.mockResolvedValue({});

      await repository.save(transaction);

      const sentCommand = client.send.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(PutCommand);
      expect(sentCommand.input.TableName).toBe('Transactions');
      expect(typeof sentCommand.input.Item.createdAt).toBe('string');
      expect(typeof sentCommand.input.Item.updatedAt).toBe('string');
      expect(sentCommand.input.Item.id).toBe('txn-1');
    });
  });
});
