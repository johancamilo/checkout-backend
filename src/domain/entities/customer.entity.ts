import { Result, DomainError } from '@domain/shared/result';

export interface CustomerProps {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  documentNumber: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Customer {
  private constructor(private props: CustomerProps) {}

  static create(props: CustomerProps): Result<Customer> {
    if (!props.fullName || props.fullName.trim().length < 3) {
      return Result.fail(
        DomainError.validation('Customer full name must have at least 3 characters'),
      );
    }
    if (!EMAIL_REGEX.test(props.email)) {
      return Result.fail(DomainError.validation('Customer email is invalid'));
    }
    if (!props.phoneNumber || props.phoneNumber.replace(/\D/g, '').length < 7) {
      return Result.fail(DomainError.validation('Customer phone number is invalid'));
    }
    if (!props.documentNumber || props.documentNumber.trim().length === 0) {
      return Result.fail(DomainError.validation('Customer document number is required'));
    }
    return Result.ok(new Customer(props));
  }

  get id(): string {
    return this.props.id;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get email(): string {
    return this.props.email;
  }
  get phoneNumber(): string {
    return this.props.phoneNumber;
  }
  get documentNumber(): string {
    return this.props.documentNumber;
  }

  toPrimitives(): CustomerProps {
    return { ...this.props };
  }
}
