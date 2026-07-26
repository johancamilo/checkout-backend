import { Transaction, TransactionStatus, TransactionProps } from '@domain/entities/transaction.entity';

describe('Transaction', () => {
  const baseInput = {
    id: 'txn-1',
    productId: 'product-1',
    customerId: 'customer-1',
    quantity: 2,
    productAmountInCents: 10000000,
    baseFeeInCents: 500000,
    deliveryFeeInCents: 200000,
  };

  describe('create', () => {
    it('creates a valid PENDING transaction', () => {
      const result = Transaction.create(baseInput);

      expect(result.isSuccess).toBe(true);
      const txn = result.value;
      expect(txn.id).toBe(baseInput.id);
      expect(txn.productId).toBe(baseInput.productId);
      expect(txn.customerId).toBe(baseInput.customerId);
      expect(txn.quantity).toBe(baseInput.quantity);
      expect(txn.status).toBe(TransactionStatus.PENDING);
      expect(txn.gatewayTransactionId).toBeUndefined();
    });

    it('fails when quantity is zero', () => {
      const result = Transaction.create({ ...baseInput, quantity: 0 });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Quantity must be greater than zero');
    });

    it('fails when quantity is negative', () => {
      const result = Transaction.create({ ...baseInput, quantity: -1 });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Quantity must be greater than zero');
    });

    it('fails when productAmountInCents is zero', () => {
      const result = Transaction.create({ ...baseInput, productAmountInCents: 0 });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Product amount must be greater than zero');
    });

    it('fails when baseFeeInCents is negative', () => {
      const result = Transaction.create({ ...baseInput, baseFeeInCents: -1 });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Fees cannot be negative');
    });

    it('fails when deliveryFeeInCents is negative', () => {
      const result = Transaction.create({ ...baseInput, deliveryFeeInCents: -1 });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Fees cannot be negative');
    });

    it('allows fees to be zero', () => {
      const result = Transaction.create({
        ...baseInput,
        baseFeeInCents: 0,
        deliveryFeeInCents: 0,
      });

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('fromPersistence', () => {
    it('rehydrates a Transaction from stored props without validation', () => {
      const now = new Date();
      const props: TransactionProps = {
        ...baseInput,
        status: TransactionStatus.APPROVED,
        gatewayTransactionId: 'gw-1',
        gatewayPaymentStatus: 'APPROVED',
        createdAt: now,
        updatedAt: now,
      };

      const txn = Transaction.fromPersistence(props);

      expect(txn.status).toBe(TransactionStatus.APPROVED);
      expect(txn.gatewayTransactionId).toBe('gw-1');
    });
  });

  describe('totalAmountInCents', () => {
    it('sums product amount, base fee and delivery fee', () => {
      const txn = Transaction.create(baseInput).value;

      expect(txn.totalAmountInCents).toBe(10000000 + 500000 + 200000);
    });
  });

  describe('applyGatewayResult', () => {
    it('transitions PENDING to APPROVED', () => {
      const txn = Transaction.create(baseInput).value;

      const result = txn.applyGatewayResult({
        newStatus: TransactionStatus.APPROVED,
        gatewayTransactionId: 'gw-1',
        gatewayPaymentStatus: 'APPROVED',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe(TransactionStatus.APPROVED);
      expect(result.value.gatewayTransactionId).toBe('gw-1');
      expect(result.value).not.toBe(txn); // new instance
      expect(txn.status).toBe(TransactionStatus.PENDING); // original untouched
    });

    it('transitions PENDING to DECLINED', () => {
      const txn = Transaction.create(baseInput).value;

      const result = txn.applyGatewayResult({
        newStatus: TransactionStatus.DECLINED,
        gatewayTransactionId: 'gw-2',
        gatewayPaymentStatus: 'DECLINED',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe(TransactionStatus.DECLINED);
    });

    it('transitions PENDING to ERROR', () => {
      const txn = Transaction.create(baseInput).value;

      const result = txn.applyGatewayResult({
        newStatus: TransactionStatus.ERROR,
        gatewayTransactionId: '',
        gatewayPaymentStatus: 'timeout',
      });

      expect(result.isSuccess).toBe(true);
      expect(result.value.status).toBe(TransactionStatus.ERROR);
    });

    it('fails when trying to transition back to PENDING', () => {
      const txn = Transaction.create(baseInput).value;

      const result = txn.applyGatewayResult({
        newStatus: TransactionStatus.PENDING,
        gatewayTransactionId: '',
        gatewayPaymentStatus: '',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Cannot transition back to PENDING');
    });

    it('fails when transaction is already in a terminal state (APPROVED)', () => {
      const txn = Transaction.create(baseInput).value;
      const approved = txn.applyGatewayResult({
        newStatus: TransactionStatus.APPROVED,
        gatewayTransactionId: 'gw-1',
        gatewayPaymentStatus: 'APPROVED',
      }).value;

      const result = approved.applyGatewayResult({
        newStatus: TransactionStatus.DECLINED,
        gatewayTransactionId: 'gw-3',
        gatewayPaymentStatus: 'DECLINED',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Cannot transition transaction');
    });

    it('fails when transaction is already in a terminal state (ERROR)', () => {
      const txn = Transaction.create(baseInput).value;
      const errored = txn.applyGatewayResult({
        newStatus: TransactionStatus.ERROR,
        gatewayTransactionId: '',
        gatewayPaymentStatus: 'timeout',
      }).value;

      const result = errored.applyGatewayResult({
        newStatus: TransactionStatus.APPROVED,
        gatewayTransactionId: 'gw-1',
        gatewayPaymentStatus: 'APPROVED',
      });

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Cannot transition transaction');
    });
  });

  describe('isApproved', () => {
    it('returns false for a PENDING transaction', () => {
      const txn = Transaction.create(baseInput).value;

      expect(txn.isApproved()).toBe(false);
    });

    it('returns true for an APPROVED transaction', () => {
      const txn = Transaction.create(baseInput).value;
      const approved = txn.applyGatewayResult({
        newStatus: TransactionStatus.APPROVED,
        gatewayTransactionId: 'gw-1',
        gatewayPaymentStatus: 'APPROVED',
      }).value;

      expect(approved.isApproved()).toBe(true);
    });

    it('returns false for a DECLINED transaction', () => {
      const txn = Transaction.create(baseInput).value;
      const declined = txn.applyGatewayResult({
        newStatus: TransactionStatus.DECLINED,
        gatewayTransactionId: 'gw-1',
        gatewayPaymentStatus: 'DECLINED',
      }).value;

      expect(declined.isApproved()).toBe(false);
    });
  });

  describe('toPrimitives', () => {
    it('returns a copy of the underlying props', () => {
      const txn = Transaction.create(baseInput).value;

      const primitives = txn.toPrimitives();

      expect(primitives.id).toBe(baseInput.id);
      expect(primitives.status).toBe(TransactionStatus.PENDING);
      expect(primitives).not.toBe((txn as any).props);
    });
  });
});