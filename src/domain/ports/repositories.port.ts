import { Product } from '@domain/entities/product.entity';
import { Transaction } from '@domain/entities/transaction.entity';
import { Customer } from '@domain/entities/customer.entity';
import { Delivery } from '@domain/entities/delivery.entity';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');
export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');
export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');

/**
 * Thrown by ProductRepository#decreaseStock when the atomic, conditional
 * decrement could not be applied — either the product doesn't exist, or its
 * stock is lower than the requested quantity. DynamoDB's ConditionExpression
 * can't distinguish between those two cases without an extra read, so both
 * surface as this single, unambiguous "the decrement did not happen" error.
 */
export class InsufficientStockPersistenceError extends Error {
  constructor(
    public readonly productId: string,
    public readonly quantity: number,
  ) {
    super(
      `Could not decrease stock by ${quantity} for product ${productId}: ` +
        'product not found or insufficient stock at the time of the update',
    );
    this.name = 'InsufficientStockPersistenceError';
  }
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
  /**
   * Atomically decreases stock by `quantity` and returns the updated
   * Product. Implementations must guarantee this is race-safe under
   * concurrent callers (e.g. via a DynamoDB conditional UpdateCommand, or a
   * SQL `UPDATE ... WHERE stock >= :quantity`) rather than a
   * read-then-write. Throws InsufficientStockPersistenceError if the
   * condition isn't met.
   */
  decreaseStock(productId: string, quantity: number): Promise<Product>;
}

export interface TransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  save(transaction: Transaction): Promise<void>;
}

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}

export interface DeliveryRepository {
  findByTransactionId(transactionId: string): Promise<Delivery | null>;
  save(delivery: Delivery): Promise<void>;
}