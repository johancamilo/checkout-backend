import { GetTransactionUseCase } from './get-transaction.use-case';
import { Transaction, TransactionStatus } from '@domain/entities/transaction.entity';

describe('GetTransactionUseCase', () => {
  let transactionRepository: { findById: jest.Mock };
  let useCase: GetTransactionUseCase;

  beforeEach(() => {
    transactionRepository = { findById: jest.fn() };
    useCase = new GetTransactionUseCase(transactionRepository as any);
  });

  it('returns the transaction when it exists', async () => {
    const transaction = Transaction.fromPersistence({
      id: 'txn-1',
      productId: 'prod-002',
      customerId: 'cust-1',
      quantity: 1,
      productAmountInCents: 45000000,
      baseFeeInCents: 500000,
      deliveryFeeInCents: 200000,
      status: TransactionStatus.APPROVED,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    transactionRepository.findById.mockResolvedValue(transaction);

    const result = await useCase.execute('txn-1');

    expect(transactionRepository.findById).toHaveBeenCalledWith('txn-1');
    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe(TransactionStatus.APPROVED);
  });

  it('fails with NOT_FOUND when the transaction does not exist', async () => {
    transactionRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute('txn-404');

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toMatch(/not found/);
  });
});
