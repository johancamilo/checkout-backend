import { Module } from '@nestjs/common';

import { loadConfig } from '@config/app.config';

import { PRODUCT_REPOSITORY, TRANSACTION_REPOSITORY, CUSTOMER_REPOSITORY, DELIVERY_REPOSITORY } from '@domain/ports/repositories.port';
import { PAYMENT_GATEWAY } from '@domain/ports/payment-gateway.port';

import { GetProductUseCase } from '@application/use-cases/get-product.use-case';
import { CreateTransactionUseCase } from '@application/use-cases/create-transaction.use-case';
import { ConfirmPaymentUseCase } from '@application/use-cases/confirm-payment.use-case';
import { GetTransactionUseCase } from '@application/use-cases/get-transaction.use-case';

import { DYNAMODB_DOCUMENT_CLIENT, createDynamoDBDocumentClient } from '@infrastructure/persistence/dynamodb/dynamodb-client.provider';
import { DynamoDBProductRepository } from '@infrastructure/persistence/dynamodb/product.repository';
import { DynamoDBTransactionRepository } from '@infrastructure/persistence/dynamodb/transaction.repository';
import { DynamoDBCustomerRepository } from '@infrastructure/persistence/dynamodb/customer.repository';
import { DynamoDBDeliveryRepository } from '@infrastructure/persistence/dynamodb/delivery.repository';
import { PaymentGatewayAdapter } from '@infrastructure/payment/gateway/payment-gateway.adapter';

import { ProductsController } from '@infrastructure/http/controllers/products.controller';
import { TransactionsController } from '@infrastructure/http/controllers/transactions.controller';

const APP_CONFIG_PROVIDER = { provide: 'APP_CONFIG', useValue: loadConfig() };

@Module({
  controllers: [ProductsController, TransactionsController],
  providers: [
    APP_CONFIG_PROVIDER,
    {
      provide: DYNAMODB_DOCUMENT_CLIENT,
      inject: ['APP_CONFIG'],
      useFactory: createDynamoDBDocumentClient,
    },
    // Ports -> Adapters wiring. This is the ONLY file in the codebase that
    // knows both the domain ports and their concrete infrastructure
    // implementations - everything else depends only on interfaces.
    { provide: PRODUCT_REPOSITORY, useClass: DynamoDBProductRepository },
    { provide: TRANSACTION_REPOSITORY, useClass: DynamoDBTransactionRepository },
    { provide: CUSTOMER_REPOSITORY, useClass: DynamoDBCustomerRepository },
    { provide: DELIVERY_REPOSITORY, useClass: DynamoDBDeliveryRepository },
    {
      provide: PAYMENT_GATEWAY,
      inject: ['APP_CONFIG'],
      useFactory: (config) => new PaymentGatewayAdapter(config),
    },
    GetProductUseCase,
    CreateTransactionUseCase,
    ConfirmPaymentUseCase,
    GetTransactionUseCase,
  ],
})
export class AppModule {}
