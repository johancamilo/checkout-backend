import { Inject, Injectable } from '@nestjs/common';
import { Result, DomainError } from '@domain/shared/result';
import { Transaction } from '@domain/entities/transaction.entity';
import {
  TRANSACTION_REPOSITORY,
  TransactionRepository,
} from '@domain/ports/repositories.port';

@Injectable()
export class GetTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(transactionId: string): Promise<Result<Transaction, DomainError>> {
    const transaction = await this.transactionRepository.findById(transactionId);
    if (!transaction) {
      return Result.fail(DomainError.notFound(`Transaction ${transactionId} not found`));
    }
    return Result.ok(transaction);
  }
}
