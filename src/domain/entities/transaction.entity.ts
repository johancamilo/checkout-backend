import { Result, DomainError } from '@domain/shared/result';

export enum TransactionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  ERROR = 'ERROR',
}

export interface TransactionProps {
  id: string;
  productId: string;
  customerId: string;
  quantity: number;
  productAmountInCents: number;
  baseFeeInCents: number;
  deliveryFeeInCents: number;
  status: TransactionStatus;
  gatewayTransactionId?: string;
  gatewayPaymentStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Valid state transitions. PENDING is the only starting state and it is a
// terminal-reaching state: once APPROVED/DECLINED/ERROR, it cannot change again.
const ALLOWED_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  [TransactionStatus.PENDING]: [
    TransactionStatus.APPROVED,
    TransactionStatus.DECLINED,
    TransactionStatus.ERROR,
  ],
  [TransactionStatus.APPROVED]: [],
  [TransactionStatus.DECLINED]: [],
  [TransactionStatus.ERROR]: [],
};

export class Transaction {
  private constructor(private props: TransactionProps) {}

  static create(
    props: Omit<TransactionProps, 'status' | 'createdAt' | 'updatedAt'>,
  ): Result<Transaction> {
    if (props.quantity <= 0) {
      return Result.fail(DomainError.validation('Quantity must be greater than zero'));
    }
    if (props.productAmountInCents <= 0) {
      return Result.fail(DomainError.validation('Product amount must be greater than zero'));
    }
    if (props.baseFeeInCents < 0 || props.deliveryFeeInCents < 0) {
      return Result.fail(DomainError.validation('Fees cannot be negative'));
    }
    const now = new Date();
    return Result.ok(
      new Transaction({
        ...props,
        status: TransactionStatus.PENDING,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  static fromPersistence(props: TransactionProps): Transaction {
    return new Transaction(props);
  }

  get id(): string {
    return this.props.id;
  }
  get productId(): string {
    return this.props.productId;
  }
  get customerId(): string {
    return this.props.customerId;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get status(): TransactionStatus {
    return this.props.status;
  }
  get gatewayTransactionId(): string | undefined {
    return this.props.gatewayTransactionId;
  }

  get productAmountInCents(): number {
    return this.props.productAmountInCents;
  }
  get baseFeeInCents(): number {
    return this.props.baseFeeInCents;
  }
  get deliveryFeeInCents(): number {
    return this.props.deliveryFeeInCents;
  }

  get totalAmountInCents(): number {
    return (
      this.props.productAmountInCents +
      this.props.baseFeeInCents +
      this.props.deliveryFeeInCents
    );
  }

  /**
   * Applies the payment gateway result to this transaction, enforcing the
   * state machine. Returns a new Transaction on success or a DomainError if
   * the transition is not allowed (e.g. trying to update an already-closed
   * transaction, which points to a duplicate webhook/retry).
   */
  applyGatewayResult(params: {
    newStatus: TransactionStatus;
    gatewayTransactionId: string;
    gatewayPaymentStatus: string;
  }): Result<Transaction> {
    if (params.newStatus === TransactionStatus.PENDING) {
      return Result.fail(
        DomainError.invalidStateTransition('Cannot transition back to PENDING'),
      );
    }
    const allowed = ALLOWED_TRANSITIONS[this.props.status];
    if (!allowed.includes(params.newStatus)) {
      return Result.fail(
        DomainError.invalidStateTransition(
          `Cannot transition transaction ${this.props.id} from ${this.props.status} to ${params.newStatus}`,
        ),
      );
    }
    return Result.ok(
      new Transaction({
        ...this.props,
        status: params.newStatus,
        gatewayTransactionId: params.gatewayTransactionId,
        gatewayPaymentStatus: params.gatewayPaymentStatus,
        updatedAt: new Date(),
      }),
    );
  }

  isApproved(): boolean {
    return this.props.status === TransactionStatus.APPROVED;
  }

  toPrimitives(): TransactionProps {
    return { ...this.props };
  }
}