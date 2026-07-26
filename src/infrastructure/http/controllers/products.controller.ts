import { Controller, Get, Param, Inject } from '@nestjs/common';
import { GetProductUseCase } from '@application/use-cases/get-product.use-case';
import { toHttpException } from '../http-error.mapper';

@Controller('products')
export class ProductsController {
  constructor(
    @Inject(GetProductUseCase)
    private readonly getProductUseCase: GetProductUseCase,
  ) {}

  @Get(':id')
  async getById(@Param('id') id: string) {
    const result = await this.getProductUseCase.execute(id);
    if (result.isFailure) {
      throw toHttpException(result.error);
    }
    const product = result.value;
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      priceInCents: product.priceInCents,
      stock: product.stock,
      imageUrl: product.imageUrl,
    };
  }
}
