import { Result, DomainError } from '@domain/shared/result';

export interface ProductProps {
  id: string;
  name: string;
  description: string;
  priceInCents: number; // stored in cents to avoid float rounding issues
  stock: number;
  imageUrl?: string;
}

/**
 * Product aggregate. Encapsulates stock invariants: stock can never go
 * negative, and reservations/decrements are the only way to mutate it.
 */
export class Product {
  private constructor(private props: ProductProps) {}

  static create(props: ProductProps): Result<Product> {
    if (!props.name || props.name.trim().length === 0) {
      return Result.fail(DomainError.validation('Product name is required'));
    }
    if (props.priceInCents <= 0) {
      return Result.fail(
        DomainError.validation('Product price must be greater than zero'),
      );
    }
    if (props.stock < 0) {
      return Result.fail(DomainError.validation('Product stock cannot be negative'));
    }
    return Result.ok(new Product(props));
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get priceInCents(): number {
    return this.props.priceInCents;
  }

  get stock(): number {
    return this.props.stock;
  }

  get imageUrl(): string | undefined {
    return this.props.imageUrl;
  }

  hasStockFor(units: number): boolean {
    return this.props.stock >= units;
  }

  /** Returns a new Product instance with stock decremented, or a failure if insufficient. */
  decreaseStock(units: number): Result<Product> {
    if (units <= 0) {
      return Result.fail(DomainError.validation('Units must be greater than zero'));
    }
    if (!this.hasStockFor(units)) {
      return Result.fail(
        DomainError.insufficientStock(
          `Not enough stock for product ${this.props.id}. Available: ${this.props.stock}, requested: ${units}`,
        ),
      );
    }
    return Product.create({ ...this.props, stock: this.props.stock - units });
  }

  toPrimitives(): ProductProps {
    return { ...this.props };
  }
}
