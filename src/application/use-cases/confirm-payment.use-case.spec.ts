import { ConfirmPaymentUseCase } from '@application/use-cases/confirm-payment.use-case';
import { Result, DomainError } from '@domain/shared/result';
import { Transaction, TransactionStatus } from '@domain/entities/transaction.entity';
import { Product } from '@domain/entities/product.entity';
import { InsufficientStockPersistenceError } from '@domain/ports/repositories.port';

describe('ConfirmPaymentUseCase', () => {
  let transactionRepository: any;
  let productRepository: any;
  let customerRepository: any;
  let paymentGateway: any;
  let useCase: ConfirmPaymentUseCase;

  const card = {
    number: '4111111111111111',
    cvc: '123',
    expMonth: '12',
    expYear: '29',
    cardHolder: 'Johan Camilo',
  };

  const makePendingTransaction = () =>
    Transaction.create({
      id: 'txn-1',
      productId: 'product-1',
      customerId: 'customer-1',
      quantity: 1,
      productAmountInCents: 5000000,
      baseFeeInCents: 200000,
      deliveryFeeInCents: 0,
    }).value;

  const makeProduct = (stock = 5) =>
    Product.create({
      id: 'product-1',
      name: 'Test product',
      description: 'desc',
      priceInCents: 5000000,
      stock,
    }).value;

  beforeEach(() => {
    transactionRepository = { findById: jest.fn(), save: jest.fn() };
    productRepository = { findById: jest.fn(), save: jest.fn(), decreaseStock: jest.fn() };
    customerRepository = { findById: jest.fn() };
    paymentGateway = { tokenizeCard: jest.fn(), charge: jest.fn() };

    useCase = new ConfirmPaymentUseCase(
      transactionRepository,
      productRepository,
      customerRepository,
      paymentGateway,
    );
  });

  it('fails when transaction does not exist', async () => {
    transactionRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute({ transactionId: 'txn-1', card });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('not found');
  });

  it('fails when transaction is not PENDING (idempotency guard)', async () => {
    const pending = makePendingTransaction();
    const approved = pending.applyGatewayResult({
      newStatus: TransactionStatus.APPROVED,
      gatewayTransactionId: 'gw-0',
      gatewayPaymentStatus: 'APPROVED',
    }).value;
    transactionRepository.findById.mockResolvedValue(approved);

    const result = await useCase.execute({ transactionId: 'txn-1', card });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('already');
  });

  it('fails when customer does not exist', async () => {
    transactionRepository.findById.mockResolvedValue(makePendingTransaction());
    customerRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute({ transactionId: 'txn-1', card });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('Customer');
  });

  it('marks transaction as ERROR when tokenization fails', async () => {
    transactionRepository.findById.mockResolvedValue(makePendingTransaction());
    customerRepository.findById.mockResolvedValue({ email: 'johan@example.com' });
    paymentGateway.tokenizeCard.mockResolvedValue(
      Result.fail(DomainError.paymentGatewayError('token error')),
    );

    const result = await useCase.execute({ transactionId: 'txn-1', card });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toBe('token error');
    expect(transactionRepository.save).toHaveBeenCalledTimes(1);
    const saved = transactionRepository.save.mock.calls[0][0] as Transaction;
    expect(saved.status).toBe(TransactionStatus.ERROR);
  });

  it('marks transaction as ERROR when charge fails', async () => {
    transactionRepository.findById.mockResolvedValue(makePendingTransaction());
    customerRepository.findById.mockResolvedValue({ email: 'johan@example.com' });
    paymentGateway.tokenizeCard.mockResolvedValue(Result.ok('token-abc'));
    paymentGateway.charge.mockResolvedValue(
      Result.fail(DomainError.paymentGatewayError('charge error')),
    );

    const result = await useCase.execute({ transactionId: 'txn-1', card });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toBe('charge error');
    const saved = transactionRepository.save.mock.calls[0][0] as Transaction;
    expect(saved.status).toBe(TransactionStatus.ERROR);
  });

  it('fails with infrastructure error when the product no longer exists or has no stock after an approved charge', async () => {
    transactionRepository.findById.mockResolvedValue(makePendingTransaction());
    customerRepository.findById.mockResolvedValue({ email: 'johan@example.com' });
    paymentGateway.tokenizeCard.mockResolvedValue(Result.ok('token-abc'));
    paymentGateway.charge.mockResolvedValue(
      Result.ok({ status: 'APPROVED', gatewayTransactionId: 'gw-1', rawStatus: 'APPROVED' }),
    );
    // The atomic conditional decrement failed: either the product doesn't
    // exist anymore, or another concurrent approved payment already took
    // the remaining stock. DynamoDB's ConditionExpression can't distinguish
    // between the two without an extra read, so both surface identically.
    productRepository.decreaseStock.mockRejectedValue(
      new InsufficientStockPersistenceError('product-1', 1),
    );

    const result = await useCase.execute({ transactionId: 'txn-1', card });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('stock could not be decreased');
    expect(productRepository.decreaseStock).toHaveBeenCalledWith('product-1', 1);
  });

  it('propagates unexpected (non-stock) errors from decreaseStock instead of swallowing them', async () => {
    transactionRepository.findById.mockResolvedValue(makePendingTransaction());
    customerRepository.findById.mockResolvedValue({ email: 'johan@example.com' });
    paymentGateway.tokenizeCard.mockResolvedValue(Result.ok('token-abc'));
    paymentGateway.charge.mockResolvedValue(
      Result.ok({ status: 'APPROVED', gatewayTransactionId: 'gw-1', rawStatus: 'APPROVED' }),
    );
    productRepository.decreaseStock.mockRejectedValue(new Error('DynamoDB is unavailable'));

    await expect(useCase.execute({ transactionId: 'txn-1', card })).rejects.toThrow(
      'DynamoDB is unavailable',
    );
  });

  it('succeeds and atomically decreases stock when payment is approved', async () => {
    transactionRepository.findById.mockResolvedValue(makePendingTransaction());
    customerRepository.findById.mockResolvedValue({ email: 'johan@example.com' });
    paymentGateway.tokenizeCard.mockResolvedValue(Result.ok('token-abc'));
    paymentGateway.charge.mockResolvedValue(
      Result.ok({ status: 'APPROVED', gatewayTransactionId: 'gw-1', rawStatus: 'APPROVED' }),
    );
    productRepository.decreaseStock.mockResolvedValue(makeProduct(4));

    const result = await useCase.execute({ transactionId: 'txn-1', card });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe(TransactionStatus.APPROVED);
    expect(productRepository.decreaseStock).toHaveBeenCalledWith('product-1', 1);
    expect(productRepository.findById).not.toHaveBeenCalled();
    expect(productRepository.save).not.toHaveBeenCalled();
  });

  it('succeeds without touching stock when payment is declined', async () => {
    transactionRepository.findById.mockResolvedValue(makePendingTransaction());
    customerRepository.findById.mockResolvedValue({ email: 'johan@example.com' });
    paymentGateway.tokenizeCard.mockResolvedValue(Result.ok('token-abc'));
    paymentGateway.charge.mockResolvedValue(
      Result.ok({ status: 'DECLINED', gatewayTransactionId: 'gw-1', rawStatus: 'DECLINED' }),
    );

    const result = await useCase.execute({ transactionId: 'txn-1', card });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe(TransactionStatus.DECLINED);
    expect(productRepository.decreaseStock).not.toHaveBeenCalled();
  });
});