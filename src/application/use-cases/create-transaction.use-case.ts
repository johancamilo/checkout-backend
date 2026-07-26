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
  deliveryFeeInCents: number;
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
      deliveryFeeInCents: input.deliveryFeeInCents,
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
      feeInCents: input.deliveryFeeInCents,
    });
    if (deliveryResult.isFailure) {
      return Result.fail(deliveryResult.error);
    }
    const delivery = deliveryResult.value;

    // 5. Persist everything. (In a real system this would be a transactional
    //    write; DynamoDB supports TransactWriteItems for this if needed.)
    await this.customerRepository.save(customer);
    await this.transactionRepository.save(transaction);
    await this.deliveryRepository.save(delivery);

    return Result.ok({ transaction, customer, delivery });
  }
}
