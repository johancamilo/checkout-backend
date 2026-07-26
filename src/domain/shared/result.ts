/**
 * Railway Oriented Programming primitive.
 *
 * Every use case returns a Result<T, E> instead of throwing exceptions for
 * expected business failures (validation errors, not-found, payment declined,
 * insufficient stock, etc). Exceptions are reserved for truly unexpected
 * infrastructure failures.
 *
 * This lets use cases be composed as a "railway": each step either continues
 * on the success track (map/flatMap) or short-circuits to the failure track,
 * without nested if/else or try/catch scattered through business logic.
 */
export class Result<T, E = DomainError> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {}

  static ok<T, E = DomainError>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  static fail<T, E = DomainError>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  get isSuccess(): boolean {
    return this._isSuccess;
  }

  get isFailure(): boolean {
    return !this._isSuccess;
  }

  /** Unwraps the success value. Throws if called on a failed Result. */
  get value(): T {
    if (!this._isSuccess) {
      throw new Error(
        `Cannot get value of a failed result. Error: ${JSON.stringify(this._error)}`,
      );
    }
    return this._value as T;
  }

  get error(): E {
    if (this._isSuccess) {
      throw new Error('Cannot get error of a successful result.');
    }
    return this._error as E;
  }

  /** Transforms the success value, propagates failure untouched. */
  map<U>(fn: (value: T) => U): Result<U, E> {
    if (this.isFailure) return Result.fail<U, E>(this._error as E);
    return Result.ok<U, E>(fn(this._value as T));
  }

  /** Chains another Result-returning operation on the success track. */
  async flatMap<U>(
    fn: (value: T) => Promise<Result<U, E>>,
  ): Promise<Result<U, E>> {
    if (this.isFailure) return Result.fail<U, E>(this._error as E);
    return fn(this._value as T);
  }

  /** Chains another Result-returning synchronous operation. */
  flatMapSync<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    if (this.isFailure) return Result.fail<U, E>(this._error as E);
    return fn(this._value as T);
  }
}

export enum DomainErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  PAYMENT_DECLINED = 'PAYMENT_DECLINED',
  PAYMENT_GATEWAY_ERROR = 'PAYMENT_GATEWAY_ERROR',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  INFRASTRUCTURE_ERROR = 'INFRASTRUCTURE_ERROR',
}

export class DomainError {
  constructor(
    public readonly code: DomainErrorCode,
    public readonly message: string,
    public readonly details?: Record<string, unknown>,
  ) {}

  static validation(message: string, details?: Record<string, unknown>) {
    return new DomainError(DomainErrorCode.VALIDATION_ERROR, message, details);
  }

  static notFound(message: string) {
    return new DomainError(DomainErrorCode.NOT_FOUND, message);
  }

  static insufficientStock(message: string) {
    return new DomainError(DomainErrorCode.INSUFFICIENT_STOCK, message);
  }

  static paymentDeclined(message: string, details?: Record<string, unknown>) {
    return new DomainError(
      DomainErrorCode.PAYMENT_DECLINED,
      message,
      details,
    );
  }

  static paymentGatewayError(message: string) {
    return new DomainError(DomainErrorCode.PAYMENT_GATEWAY_ERROR, message);
  }

  static invalidStateTransition(message: string) {
    return new DomainError(DomainErrorCode.INVALID_STATE_TRANSITION, message);
  }

  static infrastructure(message: string) {
    return new DomainError(DomainErrorCode.INFRASTRUCTURE_ERROR, message);
  }
}
