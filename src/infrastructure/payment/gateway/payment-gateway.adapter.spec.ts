import axios from 'axios';
import { PaymentGatewayAdapter } from './payment-gateway.adapter';
import { AppConfig } from '@config/app.config';
import { Logger } from '@nestjs/common';

jest.mock('axios');

describe('PaymentGatewayAdapter', () => {
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
      publicKey: 'pub_test_key',
      privateKey: 'prv_test_key',
      integritySecret: 'integrity_secret',
    },
  };

  const card = {
    number: '4242 4242 4242 4242',
    cvc: '123',
    expMonth: '12',
    expYear: '29',
    cardHolder: 'Jane Doe',
  };

  let httpClient: { post: jest.Mock; get: jest.Mock };
  let adapter: PaymentGatewayAdapter;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeAll(() => {
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterAll(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  beforeEach(() => {
    httpClient = { post: jest.fn(), get: jest.fn() };
    (axios.create as jest.Mock).mockReturnValue(httpClient);
    (axios.isAxiosError as unknown as jest.Mock) = jest.fn().mockReturnValue(false);
    adapter = new PaymentGatewayAdapter(config);
  });

  describe('tokenizeCard', () => {
    it('returns the token id on success', async () => {
      httpClient.post.mockResolvedValue({ data: { data: { id: 'tok_123' } } });

      const result = await adapter.tokenizeCard(card);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe('tok_123');
      expect(httpClient.post).toHaveBeenCalledWith(
        '/tokens/cards',
        expect.objectContaining({ number: '4242424242424242', cvc: '123' }),
        expect.objectContaining({ headers: { Authorization: 'Bearer pub_test_key' } }),
      );
    });

    it('fails when the gateway response has no token id', async () => {
      httpClient.post.mockResolvedValue({ data: { data: {} } });

      const result = await adapter.tokenizeCard(card);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toMatch(/did not return a card token/);
    });

    it('maps a network/axios error to a PAYMENT_GATEWAY_ERROR', async () => {
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      httpClient.post.mockRejectedValue({
        message: 'Request failed',
        response: { data: { error: { messages: { number: 'is invalid' } } } },
      });

      const result = await adapter.tokenizeCard(card);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toMatch(/tokenizing card/);
    });
  });

  describe('charge', () => {
    const chargeRequest = {
      amountInCents: 100000,
      currency: 'COP',
      reference: 'txn-1',
      customerEmail: 'buyer@example.com',
      cardToken: 'tok_123',
      card,
    };

    it('fails fast if acceptance tokens cannot be retrieved', async () => {
      httpClient.get.mockResolvedValue({ data: { data: {} } });

      const result = await adapter.charge(chargeRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toMatch(/acceptance token/);
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it('charges and returns APPROVED when the gateway settles immediately', async () => {
      httpClient.get.mockResolvedValue({
        data: {
          data: {
            presigned_acceptance: { acceptance_token: 'accept-token' },
            presigned_personal_data_auth: { acceptance_token: 'accept-personal' },
          },
        },
      });
      httpClient.post.mockResolvedValue({
        data: { data: { id: 'gw-txn-1', status: 'APPROVED' } },
      });

      const result = await adapter.charge(chargeRequest);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        gatewayTransactionId: 'gw-txn-1',
        status: 'APPROVED',
        rawStatus: 'APPROVED',
      });
    });

    it('polls until a final status when the gateway first returns PENDING', async () => {
      httpClient.get
        .mockResolvedValueOnce({
          data: {
            data: {
              presigned_acceptance: { acceptance_token: 'accept-token' },
              presigned_personal_data_auth: { acceptance_token: 'accept-personal' },
            },
          },
        })
        .mockResolvedValueOnce({ data: { data: { status: 'DECLINED' } } });
      httpClient.post.mockResolvedValue({
        data: { data: { id: 'gw-txn-2', status: 'PENDING' } },
      });

      const result = await adapter.charge(chargeRequest);

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('DECLINED');
      expect(httpClient.get).toHaveBeenCalledTimes(2);
    }, 10000);

    it('fails when the charge response is missing id/status', async () => {
      httpClient.get.mockResolvedValue({
        data: { data: { presigned_acceptance: { acceptance_token: 'accept-token' } } },
      });
      httpClient.post.mockResolvedValue({ data: { data: {} } });

      const result = await adapter.charge(chargeRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toMatch(/Unexpected response/);
    });

    it('maps a network error while creating the payment transaction', async () => {
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      httpClient.get.mockResolvedValue({
        data: { data: { presigned_acceptance: { acceptance_token: 'accept-token' } } },
      });
      httpClient.post.mockRejectedValue({ message: 'timeout' });

      const result = await adapter.charge(chargeRequest);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toMatch(/creating payment transaction/);
    });
  });

  describe('getTransactionStatus', () => {
    it('returns the mapped status on success', async () => {
      httpClient.get.mockResolvedValue({ data: { data: { status: 'APPROVED' } } });

      const result = await adapter.getTransactionStatus('gw-txn-1');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toEqual({
        gatewayTransactionId: 'gw-txn-1',
        status: 'APPROVED',
        rawStatus: 'APPROVED',
      });
    });

    it('maps unknown/other statuses to ERROR', async () => {
      httpClient.get.mockResolvedValue({ data: { data: { status: 'VOIDED' } } });

      const result = await adapter.getTransactionStatus('gw-txn-1');

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe('ERROR');
    });

    it('maps a network error to a failed Result', async () => {
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
      httpClient.get.mockRejectedValue({ message: 'network down' });

      const result = await adapter.getTransactionStatus('gw-txn-1');

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toMatch(/fetching payment transaction status/);
    });

    it('maps a non-axios error to a generic failed Result', async () => {
      (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(false);
      httpClient.get.mockRejectedValue(new Error('boom'));

      const result = await adapter.getTransactionStatus('gw-txn-1');

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toMatch(/Unexpected error/);
    });
  });
});
