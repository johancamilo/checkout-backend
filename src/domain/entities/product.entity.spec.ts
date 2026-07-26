import { Product, ProductProps } from '@domain/entities/product.entity';

describe('Product', () => {
  const validProps: ProductProps = {
    id: 'product-1',
    name: 'Wireless Headphones',
    description: 'Noise-cancelling over-ear headphones',
    priceInCents: 15000000,
    stock: 10,
    imageUrl: 'https://example.com/image.png',
  };

  it('creates a valid product', () => {
    const result = Product.create(validProps);

    expect(result.isSuccess).toBe(true);
    const product = result.value;
    expect(product.id).toBe(validProps.id);
    expect(product.name).toBe(validProps.name);
    expect(product.description).toBe(validProps.description);
    expect(product.priceInCents).toBe(validProps.priceInCents);
    expect(product.stock).toBe(validProps.stock);
    expect(product.imageUrl).toBe(validProps.imageUrl);
  });

  it('creates a valid product without imageUrl (optional field)', () => {
    const { imageUrl, ...rest } = validProps;
    const result = Product.create(rest);

    expect(result.isSuccess).toBe(true);
    expect(result.value.imageUrl).toBeUndefined();
  });

  it('fails when name is missing', () => {
    const result = Product.create({ ...validProps, name: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('name is required');
  });

  it('fails when name is only whitespace', () => {
    const result = Product.create({ ...validProps, name: '   ' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('name is required');
  });

  it('fails when priceInCents is zero', () => {
    const result = Product.create({ ...validProps, priceInCents: 0 });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('greater than zero');
  });

  it('fails when priceInCents is negative', () => {
    const result = Product.create({ ...validProps, priceInCents: -100 });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('greater than zero');
  });

  it('fails when stock is negative', () => {
    const result = Product.create({ ...validProps, stock: -1 });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('stock cannot be negative');
  });

  it('allows stock to be zero', () => {
    const result = Product.create({ ...validProps, stock: 0 });

    expect(result.isSuccess).toBe(true);
    expect(result.value.stock).toBe(0);
  });

  describe('hasStockFor', () => {
    it('returns true when stock is greater than requested units', () => {
      const product = Product.create(validProps).value;

      expect(product.hasStockFor(5)).toBe(true);
    });

    it('returns true when stock exactly equals requested units', () => {
      const product = Product.create(validProps).value;

      expect(product.hasStockFor(10)).toBe(true);
    });

    it('returns false when stock is less than requested units', () => {
      const product = Product.create(validProps).value;

      expect(product.hasStockFor(11)).toBe(false);
    });
  });

  describe('decreaseStock', () => {
    it('returns a new Product with stock decremented', () => {
      const product = Product.create(validProps).value;

      const result = product.decreaseStock(3);

      expect(result.isSuccess).toBe(true);
      expect(result.value.stock).toBe(7);
      expect(result.value).not.toBe(product); // new instance, not mutated
      expect(product.stock).toBe(10); // original untouched
    });

    it('fails when units is zero', () => {
      const product = Product.create(validProps).value;

      const result = product.decreaseStock(0);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('greater than zero');
    });

    it('fails when units is negative', () => {
      const product = Product.create(validProps).value;

      const result = product.decreaseStock(-2);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('greater than zero');
    });

    it('fails when there is not enough stock', () => {
      const product = Product.create(validProps).value;

      const result = product.decreaseStock(11);

      expect(result.isFailure).toBe(true);
      expect(result.error.message).toContain('Not enough stock');
    });

    it('allows decreasing stock to exactly zero', () => {
      const product = Product.create(validProps).value;

      const result = product.decreaseStock(10);

      expect(result.isSuccess).toBe(true);
      expect(result.value.stock).toBe(0);
    });
  });

  describe('toPrimitives', () => {
    it('returns a copy of the underlying props', () => {
      const product = Product.create(validProps).value;

      const primitives = product.toPrimitives();

      expect(primitives).toEqual(validProps);
      expect(primitives).not.toBe(validProps);
    });
  });
});