import { Product } from '@domain/entities/product.entity';
import { Transaction } from '@domain/entities/transaction.entity';
import { Customer } from '@domain/entities/customer.entity';
import { Delivery } from '@domain/entities/delivery.entity';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
export const TRANSACTION_REPOSITORY = Symbol('TRANSACTION_REPOSITORY');
export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');
export const DELIVERY_REPOSITORY = Symbol('DELIVERY_REPOSITORY');

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
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
