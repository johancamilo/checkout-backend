import { ConflictException, NotFoundException } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { CreateTransactionUseCase } from '@application/use-cases/create-transaction.use-case';
import { ConfirmPaymentUseCase } from '@application/use-cases/confirm-payment.use-case';
import { GetTransactionUseCase } from '@application/use-cases/get-transaction.use-case';
import { Transaction, TransactionStatus } from '@domain/entities/transaction.entity';
import { Delivery } from '@domain/entities/delivery.entity';
import { Customer } from '@domain/entities/customer.entity';
import { Result, DomainError } from '@domain/shared/result';

describe('TransactionsController', () => {
  let createTransactionUseCase: { execute: jest.Mock };
  let confirmPaymentUseCase: { execute: jest.Mock };
  let getTransactionUseCase: { execute: jest.Mock };
  let controller: TransactionsController;

  const makeTransaction = (status: TransactionStatus = TransactionStatus.PENDING) =>
    Transaction.fromPersistence({
      id: 'txn-1',
      productId: 'prod-002',
      customerId: 'cust-1',
      quantity: 1,
      productAmountInCents: 45000000,
      baseFeeInCents: 500000,
      deliveryFeeInCents: 200000,
      status,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

  beforeEach(() => {
    createTransactionUseCase = { execute: jest.fn() };
    confirmPaymentUseCase = { execute: jest.fn() };
    getTransactionUseCase = { execute: jest.fn() };
    controller = new TransactionsController(
      createTransactionUseCase as unknown as CreateTransactionUseCase,
      confirmPaymentUseCase as unknown as ConfirmPaymentUseCase,
      getTransactionUseCase as unknown as GetTransactionUseCase,
    );
  });

  describe('create', () => {
    const dto = {
      productId: 'prod-002',
      quantity: 1,
      customer: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phoneNumber: '3001234567',
        documentNumber: '123456789',
      },
      delivery: { addressLine: 'Calle 1 # 2-3', city: 'Bogotá', region: 'Cundinamarca' },
      deliveryFeeInCents: 200000,
    };

    it('returns the transaction breakdown on success', async () => {
      const transaction = makeTransaction();
      const delivery = Delivery.create({
        id: 'del-1',
        transactionId: 'txn-1',
        addressLine: 'Calle 1 # 2-3',
        city: 'Bogotá',
        region: 'Cundinamarca',
        feeInCents: 200000,
      }).value;
      const customer = Customer.create({
        id: 'cust-1',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phoneNumber: '3001234567',
        documentNumber: '123456789',
      }).value;
      createTransactionUseCase.execute.mockResolvedValue(
        Result.ok({ transaction, delivery, customer }),
      );

      const response = await controller.create(dto as any);

      expect(response).toEqual({
        transactionId: 'txn-1',
        status: TransactionStatus.PENDING,
        productAmountInCents: 45000000,
        baseFeeInCents: 500000,
        deliveryFeeInCents: 200000,
        totalAmountInCents: 45700000,
      });
    });

    it('translates an INSUFFICIENT_STOCK domain error into a ConflictException', async () => {
      createTransactionUseCase.execute.mockResolvedValue(
        Result.fail(DomainError.insufficientStock('Not enough stock')),
      );

      await expect(controller.create(dto as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('getById', () => {
    it('returns the current transaction status', async () => {
      getTransactionUseCase.execute.mockResolvedValue(Result.ok(makeTransaction()));

      const response = await controller.getById('txn-1');

      expect(getTransactionUseCase.execute).toHaveBeenCalledWith('txn-1');
      expect(response.transactionId).toBe('txn-1');
      expect(response.status).toBe(TransactionStatus.PENDING);
    });

    it('translates a NOT_FOUND domain error into a NotFoundException', async () => {
      getTransactionUseCase.execute.mockResolvedValue(
        Result.fail(DomainError.notFound('Transaction txn-404 not found')),
      );

      await expect(controller.getById('txn-404')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('confirmPayment', () => {
    const cardDto = {
      card: {
        number: '4242424242424242',
        cvc: '123',
        expMonth: '12',
        expYear: '29',
        cardHolder: 'Jane Doe',
      },
    };

    it('confirms the payment and returns the settled transaction', async () => {
      confirmPaymentUseCase.execute.mockResolvedValue(
        Result.ok(makeTransaction(TransactionStatus.APPROVED)),
      );

      const response = await controller.confirmPayment('txn-1', cardDto as any);

      expect(confirmPaymentUseCase.execute).toHaveBeenCalledWith({
        transactionId: 'txn-1',
        card: cardDto.card,
      });
      expect(response.status).toBe(TransactionStatus.APPROVED);
    });

    it('translates an INVALID_STATE_TRANSITION domain error into a ConflictException', async () => {
      confirmPaymentUseCase.execute.mockResolvedValue(
        Result.fail(DomainError.invalidStateTransition('Transaction txn-1 is already APPROVED')),
      );

      await expect(
        controller.confirmPayment('txn-1', cardDto as any),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
