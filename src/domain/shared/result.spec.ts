import { Result, DomainError, DomainErrorCode } from '@domain/shared/result';

describe('Result', () => {
  describe('ok / fail', () => {
    it('creates a successful result', () => {
      const result = Result.ok<number>(42);

      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBe(42);
    });

    it('creates a failed result', () => {
      const error = DomainError.validation('invalid');
      const result = Result.fail<number>(error);

      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('value getter', () => {
    it('throws when accessing value on a failed result', () => {
      const result = Result.fail<number>(DomainError.validation('bad'));

      expect(() => result.value).toThrow(/Cannot get value of a failed result/);
    });
  });

  describe('error getter', () => {
    it('throws when accessing error on a successful result', () => {
      const result = Result.ok<number>(1);

      expect(() => result.error).toThrow('Cannot get error of a successful result.');
    });
  });

  describe('map', () => {
    it('transforms the value on the success track', () => {
      const result = Result.ok<number>(2).map((v) => v * 2);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(4);
    });

    it('propagates the error untouched on the failure track', () => {
      const error = DomainError.notFound('missing');
      const result = Result.fail<number>(error).map((v) => v * 2);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('flatMap (async)', () => {
    it('chains to the next Result-returning operation on success', async () => {
      const result = await Result.ok<number>(3).flatMap(async (v) =>
        Result.ok(v + 1),
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(4);
    });

    it('short-circuits without calling fn on failure', async () => {
      const error = DomainError.insufficientStock('no stock');
      const fn = jest.fn();
      const result = await Result.fail<number>(error).flatMap(fn);

      expect(fn).not.toHaveBeenCalled();
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('flatMapSync', () => {
    it('chains to the next Result-returning operation on success', () => {
      const result = Result.ok<number>(5).flatMapSync((v) => Result.ok(v * 10));

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(50);
    });

    it('short-circuits without calling fn on failure', () => {
      const error = DomainError.paymentDeclined('declined');
      const fn = jest.fn();
      const result = Result.fail<number>(error).flatMapSync(fn);

      expect(fn).not.toHaveBeenCalled();
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
    });
  });
});

describe('DomainError', () => {
  it('builds a validation error', () => {
    const error = DomainError.validation('invalid field', { field: 'email' });

    expect(error.code).toBe(DomainErrorCode.VALIDATION_ERROR);
    expect(error.message).toBe('invalid field');
    expect(error.details).toEqual({ field: 'email' });
  });

  it('builds a notFound error', () => {
    const error = DomainError.notFound('product not found');

    expect(error.code).toBe(DomainErrorCode.NOT_FOUND);
    expect(error.message).toBe('product not found');
    expect(error.details).toBeUndefined();
  });

  it('builds an insufficientStock error', () => {
    const error = DomainError.insufficientStock('not enough stock');

    expect(error.code).toBe(DomainErrorCode.INSUFFICIENT_STOCK);
    expect(error.message).toBe('not enough stock');
  });

  it('builds a paymentDeclined error with details', () => {
    const error = DomainError.paymentDeclined('declined', { reason: 'insufficient_funds' });

    expect(error.code).toBe(DomainErrorCode.PAYMENT_DECLINED);
    expect(error.message).toBe('declined');
    expect(error.details).toEqual({ reason: 'insufficient_funds' });
  });

  it('builds a paymentGatewayError', () => {
    const error = DomainError.paymentGatewayError('gateway timeout');

    expect(error.code).toBe(DomainErrorCode.PAYMENT_GATEWAY_ERROR);
    expect(error.message).toBe('gateway timeout');
  });

  it('builds an invalidStateTransition error', () => {
    const error = DomainError.invalidStateTransition('cannot transition from APPROVED');

    expect(error.code).toBe(DomainErrorCode.INVALID_STATE_TRANSITION);
    expect(error.message).toBe('cannot transition from APPROVED');
  });

  it('builds an infrastructure error', () => {
    const error = DomainError.infrastructure('dynamodb unreachable');

    expect(error.code).toBe(DomainErrorCode.INFRASTRUCTURE_ERROR);
    expect(error.message).toBe('dynamodb unreachable');
  });
});