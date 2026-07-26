import { Delivery, DeliveryProps } from '@domain/entities/delivery.entity';
import { DomainErrorCode } from '@domain/shared/result';

describe('Delivery', () => {
  const validProps: DeliveryProps = {
    id: 'delivery-1',
    transactionId: 'txn-1',
    addressLine: 'Calle 123 #45-67',
    city: 'Bogotá',
    region: 'Cundinamarca',
    postalCode: '110111',
    feeInCents: 500000,
  };

  it('creates a valid delivery', () => {
    const result = Delivery.create(validProps);

    expect(result.isSuccess).toBe(true);
    const delivery = result.value;
    expect(delivery.id).toBe(validProps.id);
    expect(delivery.transactionId).toBe(validProps.transactionId);
    expect(delivery.addressLine).toBe(validProps.addressLine);
    expect(delivery.city).toBe(validProps.city);
    expect(delivery.region).toBe(validProps.region);
    expect(delivery.postalCode).toBe(validProps.postalCode);
    expect(delivery.feeInCents).toBe(validProps.feeInCents);
  });

  it('creates a valid delivery without postalCode (optional field)', () => {
    const { postalCode, ...rest } = validProps;
    const result = Delivery.create(rest);

    expect(result.isSuccess).toBe(true);
    expect(result.value.postalCode).toBeUndefined();
  });

  it('fails when addressLine is missing', () => {
    const result = Delivery.create({ ...validProps, addressLine: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe(DomainErrorCode.VALIDATION_ERROR);
    expect(result.error.message).toContain('address is too short');
  });

  it('fails when addressLine is shorter than 5 characters after trim', () => {
    const result = Delivery.create({ ...validProps, addressLine: '  ab ' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('address is too short');
  });

  it('fails when city is missing', () => {
    const result = Delivery.create({ ...validProps, city: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('city is required');
  });

  it('fails when city is only whitespace', () => {
    const result = Delivery.create({ ...validProps, city: '   ' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('city is required');
  });

  it('fails when region is missing', () => {
    const result = Delivery.create({ ...validProps, region: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('region is required');
  });

  it('fails when region is only whitespace', () => {
    const result = Delivery.create({ ...validProps, region: '   ' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('region is required');
  });

  it('fails when feeInCents is negative', () => {
    const result = Delivery.create({ ...validProps, feeInCents: -1 });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('fee cannot be negative');
  });

  it('allows feeInCents to be zero (free delivery)', () => {
    const result = Delivery.create({ ...validProps, feeInCents: 0 });

    expect(result.isSuccess).toBe(true);
    expect(result.value.feeInCents).toBe(0);
  });

  it('toPrimitives returns a copy of the underlying props', () => {
    const delivery = Delivery.create(validProps).value;
    const primitives = delivery.toPrimitives();

    expect(primitives).toEqual(validProps);
    expect(primitives).not.toBe(validProps);
  });
});