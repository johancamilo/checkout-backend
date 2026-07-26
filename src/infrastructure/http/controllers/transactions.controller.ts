import { Body, Controller, Get, Param, Post, Inject  } from '@nestjs/common';
import { CreateTransactionUseCase } from '@application/use-cases/create-transaction.use-case';
import { ConfirmPaymentUseCase } from '@application/use-cases/confirm-payment.use-case';
import { GetTransactionUseCase } from '@application/use-cases/get-transaction.use-case';
import { CreateTransactionDto } from '../dtos/create-transaction.dto';
import { ConfirmPaymentDto } from '../dtos/confirm-payment.dto';
import { toHttpException } from '../http-error.mapper';

@Controller('transactions')
export class TransactionsController {
  constructor(
    @Inject(CreateTransactionUseCase)
    private readonly createTransactionUseCase: CreateTransactionUseCase,
    @Inject(ConfirmPaymentUseCase)
    private readonly confirmPaymentUseCase: ConfirmPaymentUseCase,
    @Inject(GetTransactionUseCase)
    private readonly getTransactionUseCase: GetTransactionUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateTransactionDto) {
    const result = await this.createTransactionUseCase.execute(dto);
    if (result.isFailure) {
      throw toHttpException(result.error);
    }
    const { transaction, delivery } = result.value;
    return {
      transactionId: transaction.id,
      status: transaction.status,
      totalAmountInCents: transaction.totalAmountInCents,
      deliveryFeeInCents: delivery.feeInCents,
    };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const result = await this.getTransactionUseCase.execute(id);
    if (result.isFailure) {
      throw toHttpException(result.error);
    }
    const transaction = result.value;
    return {
      transactionId: transaction.id,
      productId: transaction.productId,
      status: transaction.status,
      totalAmountInCents: transaction.totalAmountInCents,
    };
  }

  @Post(':id/payments')
  async confirmPayment(@Param('id') id: string, @Body() dto: ConfirmPaymentDto) {
    const result = await this.confirmPaymentUseCase.execute({
      transactionId: id,
      card: dto.card,
    });
    if (result.isFailure) {
      throw toHttpException(result.error);
    }
    const transaction = result.value;
    return {
      transactionId: transaction.id,
      status: transaction.status,
      totalAmountInCents: transaction.totalAmountInCents,
    };
  }
}
