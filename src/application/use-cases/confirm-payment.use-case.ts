import { Inject, Injectable } from '@nestjs/common';
import { Result, DomainError } from '@domain/shared/result';
import { Transaction, TransactionStatus } from '@domain/entities/transaction.entity';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
  TRANSACTION_REPOSITORY,
  TransactionRepository,
  CUSTOMER_REPOSITORY,
  CustomerRepository,
} from '@domain/ports/repositories.port';
import {
  PAYMENT_GATEWAY,
  PaymentGateway,
  CardData,
} from '@domain/ports/payment-gateway.port';

export interface ConfirmPaymentInput {
  transactionId: string;
  card: CardData;
}

@Injectable()
export class ConfirmPaymentUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
    @Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepository,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGateway,
  ) {}

  async execute(input: ConfirmPaymentInput): Promise<Result<Transaction, DomainError>> {
    // 1. Load the PENDING transaction created in the previous step.
    const transaction = await this.transactionRepository.findById(input.transactionId);
    if (!transaction) {
      return Result.fail(
        DomainError.notFound(`Transaction ${input.transactionId} not found`),
      );
    }
    if (transaction.status !== TransactionStatus.PENDING) {
      // Idempotency guard: prevents double-charging on retries/duplicate clicks.
      return Result.fail(
        DomainError.invalidStateTransition(
          `Transaction ${transaction.id} is already ${transaction.status}`,
        ),
      );
    }

    const customer = await this.customerRepository.findById(transaction.customerId);
    if (!customer) {
      return Result.fail(
        DomainError.notFound(`Customer ${transaction.customerId} not found`),
      );
    }

    // 2. Tokenize the card with the gateway (raw card data never touches our DB).
    const tokenResult = await this.paymentGateway.tokenizeCard(input.card);
    if (tokenResult.isFailure) {
      return this.markAsError(transaction, tokenResult.error);
    }

    // 3. Charge the tokenized card.
    const chargeResult = await this.paymentGateway.charge({
      amountInCents: transaction.totalAmountInCents,
      currency: 'COP',
      reference: transaction.id,
      customerEmail: customer.email,
      cardToken: tokenResult.value,
      card: input.card,
    });
    if (chargeResult.isFailure) {
      return this.markAsError(transaction, chargeResult.error);
    }
    const charge = chargeResult.value;

    // 4. Apply the gateway result to the transaction's state machine.
    const newStatus =
      charge.status === 'APPROVED'
        ? TransactionStatus.APPROVED
        : TransactionStatus.DECLINED;

    const updatedResult = transaction.applyGatewayResult({
      newStatus,
      gatewayTransactionId: charge.gatewayTransactionId,
      gatewayPaymentStatus: charge.rawStatus,
    });
    if (updatedResult.isFailure) {
      return Result.fail(updatedResult.error);
    }
    const updatedTransaction = updatedResult.value;
    await this.transactionRepository.save(updatedTransaction);

    // 5. If approved: decrease stock now (product "assigned" to the customer).
    if (updatedTransaction.isApproved()) {
      const product = await this.productRepository.findById(updatedTransaction.productId);
      if (!product) {
        return Result.fail(
          DomainError.notFound(`Product ${updatedTransaction.productId} not found`),
        );
      }
      const decreasedResult = product.decreaseStock(updatedTransaction.quantity);
      if (decreasedResult.isFailure) {
        // Payment already went through with the gateway but we ran out of
        // stock in the meantime. This is flagged as an infrastructure/ops
        // concern (would trigger a refund flow in a real system) rather than
        // silently failing.
        return Result.fail(
          DomainError.infrastructure(
            `Payment approved but stock could not be decreased for product ${updatedTransaction.productId}: ${decreasedResult.error.message}`,
          ),
        );
      }
      await this.productRepository.save(decreasedResult.value);
    }

    return Result.ok(updatedTransaction);
  }

  private async markAsError(
    transaction: Transaction,
    error: DomainError,
  ): Promise<Result<Transaction, DomainError>> {
    const errorResult = transaction.applyGatewayResult({
      newStatus: TransactionStatus.ERROR,
      gatewayTransactionId: '',
      gatewayPaymentStatus: error.message,
    });
    if (errorResult.isSuccess) {
      await this.transactionRepository.save(errorResult.value);
    }
    return Result.fail(error);
  }
}
