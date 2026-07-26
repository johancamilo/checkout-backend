import { NotFoundException } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { GetProductUseCase } from '@application/use-cases/get-product.use-case';
import { Product } from '@domain/entities/product.entity';
import { Result, DomainError } from '@domain/shared/result';

describe('ProductsController', () => {
  let getProductUseCase: { execute: jest.Mock };
  let controller: ProductsController;

  beforeEach(() => {
    getProductUseCase = { execute: jest.fn() };
    controller = new ProductsController(
      getProductUseCase as unknown as GetProductUseCase,
    );
  });

  it('returns the serialized product on success', async () => {
    const product = Product.create({
      id: 'prod-002',
      name: 'Headphones',
      description: 'Noise cancelling',
      priceInCents: 45000000,
      stock: 8,
      imageUrl: 'https://placehold.co/600x400',
    }).value;
    getProductUseCase.execute.mockResolvedValue(Result.ok(product));

    const response = await controller.getById('prod-002');

    expect(getProductUseCase.execute).toHaveBeenCalledWith('prod-002');
    expect(response).toEqual({
      id: 'prod-002',
      name: 'Headphones',
      description: 'Noise cancelling',
      priceInCents: 45000000,
      stock: 8,
      imageUrl: 'https://placehold.co/600x400',
    });
  });

  it('translates a NOT_FOUND domain error into a NotFoundException', async () => {
    getProductUseCase.execute.mockResolvedValue(
      Result.fail(DomainError.notFound('Product prod-999 not found')),
    );

    await expect(controller.getById('prod-999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
