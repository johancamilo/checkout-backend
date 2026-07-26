import { Inject, Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { Result, DomainError } from '@domain/shared/result';
import { Customer } from '@domain/entities/customer.entity';
import { Delivery } from '@domain/entities/delivery.entity';
import { Transaction } from '@domain/entities/transaction.entity';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
  CUSTOMER_REPOSITORY,
  CustomerRepository,
  DELIVERY_REPOSITORY,
  DeliveryRepository,
  TRANSACTION_REPOSITORY,
  TransactionRepository,
} from '@domain/ports/repositories.port';

// Fixed base fee applied to every transaction, in cents (business rule).
const BASE_FEE_IN_CENTS = 500000; // e.g. $5,000 COP flat fee

// Fixed flat delivery fee, in cents (business rule). This MUST match the
// DELIVERY_FEE_IN_CENTS constant the frontend uses to render the summary
// (checkout-frontend/src/store/modules/checkout/actions.js) so what the
// customer sees before paying matches what actually gets charged.
//
// The client also sends a `deliveryFeeInCents` value in the request body
// (see CreateTransactionInput below) purely for backwards-compatible shape
// validation — it is intentionally NOT used to compute the charge. Trusting
// a client-supplied price for anything that affects the amount charged is a
// classic tampering vector (a modified request could set it to 0). If this
// ever needs to vary by city/region, replace this constant with a
// server-side lookup keyed by `input.delivery.city`/`region` — never by
// reading it back from the request.
const DELIVERY_FEE_IN_CENTS = 800000; // e.g. $8,000 COP flat fee

export interface CreateTransactionInput {
  productId: string;
  quantity: number;
  customer: {
    fullName: string;
    email: string;
    phoneNumber: string;
    documentNumber: string;
  };
  delivery: {
    addressLine: string;
    city: string;
    region: string;
    postalCode?: string;
  };
  /**
   * @deprecated advisory only — the actual charge always uses the server-side
   * DELIVERY_FEE_IN_CENTS constant, never this value. Kept optional so
   * existing/older clients that still send it don't break validation.
   */
  deliveryFeeInCents?: number;
}

export interface CreateTransactionOutput {
  transaction: Transaction;
  customer: Customer;
  delivery: Delivery;
}

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
    @Inject(CUSTOMER_REPOSITORY) private readonly customerRepository: CustomerRepository,
    @Inject(DELIVERY_REPOSITORY) private readonly deliveryRepository: DeliveryRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(
    input: CreateTransactionInput,
  ): Promise<Result<CreateTransactionOutput, DomainError>> {
    // 1. Validate product exists and has stock (real-life case: someone else
    //    bought the last units between the product page load and checkout).
    const product = await this.productRepository.findById(input.productId);
    if (!product) {
      return Result.fail(DomainError.notFound(`Product ${input.productId} not found`));
    }
    if (!product.hasStockFor(input.quantity)) {
      return Result.fail(
        DomainError.insufficientStock(
          `Not enough stock for product ${input.productId}`,
        ),
      );
    }

    // 2. Build the Customer entity (validates shape of email/phone/etc.)
    const customerResult = Customer.create({
      id: uuid(),
      ...input.customer,
    });
    if (customerResult.isFailure) {
      return Result.fail(customerResult.error);
    }
    const customer = customerResult.value;

    // 3. Build the Transaction entity in PENDING state.
    const transactionResult = Transaction.create({
      id: uuid(),
      productId: product.id,
      customerId: customer.id,
      quantity: input.quantity,
      productAmountInCents: product.priceInCents * input.quantity,
      baseFeeInCents: BASE_FEE_IN_CENTS,
      deliveryFeeInCents: DELIVERY_FEE_IN_CENTS,
    });
    if (transactionResult.isFailure) {
      return Result.fail(transactionResult.error);
    }
    const transaction = transactionResult.value;

    // 4. Build the Delivery entity, linked to the transaction.
    const deliveryResult = Delivery.create({
      id: uuid(),
      transactionId: transaction.id,
      ...input.delivery,
      feeInCents: DELIVERY_FEE_IN_CENTS,
    });
    if (deliveryResult.isFailure) {
      return Result.fail(deliveryResult.error);
    }
    const delivery = deliveryResult.value;

    // 5. Persist everything. These 3 writes are independent of each other's
    //    results, so they run concurrently instead of one round trip after
    //    another. (In a real system this would ideally also be a
    //    transactional write; DynamoDB supports TransactWriteItems for that
    //    if strict all-or-nothing atomicity across the 3 tables is needed.)
    await Promise.all([
      this.customerRepository.save(customer),
      this.transactionRepository.save(transaction),
      this.deliveryRepository.save(delivery),
    ]);

    return Result.ok({ transaction, customer, delivery });
  }
}