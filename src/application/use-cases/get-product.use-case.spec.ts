import { GetProductUseCase } from './get-product.use-case';
import { Product } from '@domain/entities/product.entity';

describe('GetProductUseCase', () => {
  let productRepository: { findById: jest.Mock };
  let useCase: GetProductUseCase;

  beforeEach(() => {
    productRepository = { findById: jest.fn() };
    useCase = new GetProductUseCase(productRepository as any);
  });

  it('returns the product when it exists', async () => {
    const product = Product.create({
      id: 'prod-002',
      name: 'Headphones',
      description: 'Noise cancelling',
      priceInCents: 45000000,
      stock: 8,
    }).value;
    productRepository.findById.mockResolvedValue(product);

    const result = await useCase.execute('prod-002');

    expect(productRepository.findById).toHaveBeenCalledWith('prod-002');
    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe('prod-002');
  });

  it('fails with NOT_FOUND when the product does not exist', async () => {
    productRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute('prod-404');

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toMatch(/not found/);
  });

  it('fails with a validation error when no productId is given', async () => {
    const result = await useCase.execute('');

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toMatch(/required/);
    expect(productRepository.findById).not.toHaveBeenCalled();
  });
});
