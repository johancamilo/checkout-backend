import { Inject, Injectable } from '@nestjs/common';
import { Result, DomainError } from '@domain/shared/result';
import { Product } from '@domain/entities/product.entity';
import {
  PRODUCT_REPOSITORY,
  ProductRepository,
} from '@domain/ports/repositories.port';

@Injectable()
export class GetProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly productRepository: ProductRepository,
  ) {}

  async execute(productId: string): Promise<Result<Product, DomainError>> {
    if (!productId) {
      return Result.fail(DomainError.validation('productId is required'));
    }
    const product = await this.productRepository.findById(productId);
    if (!product) {
      return Result.fail(DomainError.notFound(`Product ${productId} not found`));
    }
    return Result.ok(product);
  }
}
