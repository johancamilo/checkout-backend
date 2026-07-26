import { Result, DomainError } from '@domain/shared/result';

export interface DeliveryProps {
  id: string;
  transactionId: string;
  addressLine: string;
  city: string;
  region: string;
  postalCode?: string;
  feeInCents: number;
}

export class Delivery {
  private constructor(private props: DeliveryProps) {}

  static create(props: DeliveryProps): Result<Delivery> {
    if (!props.addressLine || props.addressLine.trim().length < 5) {
      return Result.fail(DomainError.validation('Delivery address is too short'));
    }
    if (!props.city || props.city.trim().length === 0) {
      return Result.fail(DomainError.validation('Delivery city is required'));
    }
    if (!props.region || props.region.trim().length === 0) {
      return Result.fail(DomainError.validation('Delivery region is required'));
    }
    if (props.feeInCents < 0) {
      return Result.fail(DomainError.validation('Delivery fee cannot be negative'));
    }
    return Result.ok(new Delivery(props));
  }

  get id(): string {
    return this.props.id;
  }
  get transactionId(): string {
    return this.props.transactionId;
  }
  get addressLine(): string {
    return this.props.addressLine;
  }
  get city(): string {
    return this.props.city;
  }
  get region(): string {
    return this.props.region;
  }
  get postalCode(): string | undefined {
    return this.props.postalCode;
  }
  get feeInCents(): number {
    return this.props.feeInCents;
  }

  toPrimitives(): DeliveryProps {
    return { ...this.props };
  }
}
