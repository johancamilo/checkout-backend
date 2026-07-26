import { CreateTransactionUseCase } from '@application/use-cases/create-transaction.use-case';
import { Product } from '@domain/entities/product.entity';

describe('CreateTransactionUseCase', () => {
  let productRepository: any;
  let customerRepository: any;
  let deliveryRepository: any;
  let transactionRepository: any;
  let useCase: CreateTransactionUseCase;

  const validInput = {
    productId: 'product-1',
    quantity: 1,
    customer: {
      fullName: 'Johan Camilo',
      email: 'johan@example.com',
      phoneNumber: '3001234567',
      documentNumber: '123456789',
    },
    delivery: {
      addressLine: 'Calle 123 #45-67',
      city: 'Bogotá',
      region: 'Cundinamarca',
    },
    deliveryFeeInCents: 200000,
  };

  const makeProduct = (overrides: Partial<{ stock: number; priceInCents: number }> = {}) =>
    Product.create({
      id: 'product-1',
      name: 'Test product',
      description: 'desc',
      priceInCents: overrides.priceInCents ?? 5000000,
      stock: overrides.stock ?? 10,
    }).value;

  beforeEach(() => {
    productRepository = { findById: jest.fn(), save: jest.fn() };
    customerRepository = { findById: jest.fn(), save: jest.fn() };
    deliveryRepository = { findById: jest.fn(), save: jest.fn() };
    transactionRepository = { findById: jest.fn(), save: jest.fn() };

    useCase = new CreateTransactionUseCase(
      productRepository,
      customerRepository,
      deliveryRepository,
      transactionRepository,
    );
  });

  it('creates transaction, customer and delivery on the happy path', async () => {
    productRepository.findById.mockResolvedValue(makeProduct());

    const result = await useCase.execute(validInput);

    expect(result.isSuccess).toBe(true);
    expect(result.value.customer.fullName).toBe(validInput.customer.fullName);
    expect(result.value.delivery.city).toBe(validInput.delivery.city);
    expect(result.value.transaction.productId).toBe('product-1');
    expect(customerRepository.save).toHaveBeenCalledWith(result.value.customer);
    expect(transactionRepository.save).toHaveBeenCalledWith(result.value.transaction);
    expect(deliveryRepository.save).toHaveBeenCalledWith(result.value.delivery);
  });

  it('ignores a client-supplied deliveryFeeInCents and always uses the fixed server-side fee', async () => {
    productRepository.findById.mockResolvedValue(makeProduct());

    // Simulate a tampered request trying to get free delivery.
    const result = await useCase.execute({ ...validInput, deliveryFeeInCents: 0 });

    expect(result.isSuccess).toBe(true);
    expect(result.value.delivery.feeInCents).toBe(800000);
    expect(result.value.transaction.deliveryFeeInCents).toBe(800000);
  });

  it('fails when product does not exist', async () => {
    productRepository.findById.mockResolvedValue(null);

    const result = await useCase.execute(validInput);

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('not found');
    expect(customerRepository.save).not.toHaveBeenCalled();
  });

  it('fails when there is not enough stock', async () => {
    productRepository.findById.mockResolvedValue(makeProduct({ stock: 0 }));

    const result = await useCase.execute({ ...validInput, quantity: 1 });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('Not enough stock');
    expect(customerRepository.save).not.toHaveBeenCalled();
  });

  it('fails when customer data is invalid', async () => {
    productRepository.findById.mockResolvedValue(makeProduct());

    const result = await useCase.execute({
      ...validInput,
      customer: { ...validInput.customer, email: 'not-an-email' },
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('email is invalid');
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('fails when delivery data is invalid', async () => {
    productRepository.findById.mockResolvedValue(makeProduct());

    const result = await useCase.execute({
      ...validInput,
      delivery: { ...validInput.delivery, city: '' },
    });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('city is required');
    expect(deliveryRepository.save).not.toHaveBeenCalled();
  });
});