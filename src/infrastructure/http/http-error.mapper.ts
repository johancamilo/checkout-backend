import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DomainError, DomainErrorCode } from '@domain/shared/result';

/**
 * Translates a DomainError (from the ROP railway) into the appropriate Nest
 * HTTP exception. Keeps this mapping out of the controllers themselves.
 */
export function toHttpException(error: DomainError): HttpException {
  const payload = { message: error.message, code: error.code, details: error.details };

  switch (error.code) {
    case DomainErrorCode.VALIDATION_ERROR:
      return new BadRequestException(payload);
    case DomainErrorCode.NOT_FOUND:
      return new NotFoundException(payload);
    case DomainErrorCode.INSUFFICIENT_STOCK:
      return new ConflictException(payload);
    case DomainErrorCode.INVALID_STATE_TRANSITION:
      return new ConflictException(payload);
    case DomainErrorCode.PAYMENT_DECLINED:
      return new BadRequestException(payload);
    case DomainErrorCode.PAYMENT_GATEWAY_ERROR:
      return new InternalServerErrorException(payload);
    case DomainErrorCode.INFRASTRUCTURE_ERROR:
    default:
      return new InternalServerErrorException(payload);
  }
}
