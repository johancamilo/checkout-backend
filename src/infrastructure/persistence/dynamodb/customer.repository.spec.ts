import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBCustomerRepository } from './customer.repository';
import { Customer } from '@domain/entities/customer.entity';
import { AppConfig } from '@config/app.config';

describe('DynamoDBCustomerRepository', () => {
  let client: { send: jest.Mock };
  let repository: DynamoDBCustomerRepository;
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
    repository = new DynamoDBCustomerRepository(client as any, config);
  });

  describe('findById', () => {
    it('returns null when the item does not exist', async () => {
      client.send.mockResolvedValue({});

      const result = await repository.findById('cust-404');

      expect(result).toBeNull();
      const sentCommand = client.send.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(GetCommand);
      expect(sentCommand.input).toEqual({
        TableName: 'Customers',
        Key: { id: 'cust-404' },
      });
    });

    it('maps a stored item back into a Customer entity', async () => {
      client.send.mockResolvedValue({
        Item: {
          id: 'cust-1',
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phoneNumber: '3001234567',
          documentNumber: '123456789',
        },
      });

      const customer = await repository.findById('cust-1');

      expect(customer).toBeInstanceOf(Customer);
      expect(customer?.fullName).toBe('Jane Doe');
    });

    it('throws when the stored record is corrupted', async () => {
      client.send.mockResolvedValue({
        Item: { id: 'cust-bad', fullName: '', email: 'nope', phoneNumber: '', documentNumber: '' },
      });

      await expect(repository.findById('cust-bad')).rejects.toThrow(/Corrupted customer record/);
    });
  });

  describe('save', () => {
    it('persists the customer primitives with a PutCommand', async () => {
      const customer = Customer.create({
        id: 'cust-1',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phoneNumber: '3001234567',
        documentNumber: '123456789',
      }).value;
      client.send.mockResolvedValue({});

      await repository.save(customer);

      const sentCommand = client.send.mock.calls[0][0];
      expect(sentCommand).toBeInstanceOf(PutCommand);
      expect(sentCommand.input).toEqual({
        TableName: 'Customers',
        Item: customer.toPrimitives(),
      });
    });
  });
});
