import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { toHttpException } from './http-error.mapper';
import { DomainError, DomainErrorCode } from '@domain/shared/result';

describe('toHttpException', () => {
  it('maps VALIDATION_ERROR to BadRequestException', () => {
    const exception = toHttpException(DomainError.validation('bad input'));
    expect(exception).toBeInstanceOf(BadRequestException);
  });

  it('maps NOT_FOUND to NotFoundException', () => {
    const exception = toHttpException(DomainError.notFound('missing'));
    expect(exception).toBeInstanceOf(NotFoundException);
  });

  it('maps INSUFFICIENT_STOCK to ConflictException', () => {
    const exception = toHttpException(DomainError.insufficientStock('no stock'));
    expect(exception).toBeInstanceOf(ConflictException);
  });

  it('maps INVALID_STATE_TRANSITION to ConflictException', () => {
    const exception = toHttpException(DomainError.invalidStateTransition('bad transition'));
    expect(exception).toBeInstanceOf(ConflictException);
  });

  it('maps PAYMENT_DECLINED to BadRequestException', () => {
    const exception = toHttpException(DomainError.paymentDeclined('declined'));
    expect(exception).toBeInstanceOf(BadRequestException);
  });

  it('maps PAYMENT_GATEWAY_ERROR to InternalServerErrorException', () => {
    const exception = toHttpException(DomainError.paymentGatewayError('gateway down'));
    expect(exception).toBeInstanceOf(InternalServerErrorException);
  });

  it('maps INFRASTRUCTURE_ERROR to InternalServerErrorException', () => {
    const exception = toHttpException(DomainError.infrastructure('db down'));
    expect(exception).toBeInstanceOf(InternalServerErrorException);
  });

  it('falls back to InternalServerErrorException for an unknown code', () => {
    const unknownError = new DomainError('SOMETHING_ELSE' as DomainErrorCode, 'weird');
    const exception = toHttpException(unknownError);
    expect(exception).toBeInstanceOf(InternalServerErrorException);
  });

  it('includes message, code and details in the exception payload', () => {
    const exception = toHttpException(
      DomainError.validation('bad input', { field: 'productId' }),
    );
    expect(exception.getResponse()).toEqual({
      message: 'bad input',
      code: DomainErrorCode.VALIDATION_ERROR,
      details: { field: 'productId' },
    });
  });
});
