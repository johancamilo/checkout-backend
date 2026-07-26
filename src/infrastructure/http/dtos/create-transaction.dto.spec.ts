import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

const validPayload = {
  productId: 'prod-002',
  quantity: 1,
  customer: {
    fullName: 'Jane Doe',
    email: 'jane@example.com',
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

async function validateDto(payload: unknown) {
  const dto = plainToInstance(CreateTransactionDto, payload);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('CreateTransactionDto', () => {
  it('passes validation with a valid payload', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('fails when productId is missing', async () => {
    const errors = await validateDto({ ...validPayload, productId: '' });
    expect(errors.some((e) => e.property === 'productId')).toBe(true);
  });

  it('fails when quantity is not a positive integer', async () => {
    const errors = await validateDto({ ...validPayload, quantity: 0 });
    expect(errors.some((e) => e.property === 'quantity')).toBe(true);
  });

  it('fails when deliveryFeeInCents is negative', async () => {
    const errors = await validateDto({ ...validPayload, deliveryFeeInCents: -1 });
    expect(errors.some((e) => e.property === 'deliveryFeeInCents')).toBe(true);
  });

  it('fails when the customer email is invalid', async () => {
    const errors = await validateDto({
      ...validPayload,
      customer: { ...validPayload.customer, email: 'not-an-email' },
    });
    const customerError = errors.find((e) => e.property === 'customer');
    expect(customerError).toBeDefined();
  });

  it('fails when the delivery address is too short', async () => {
    const errors = await validateDto({
      ...validPayload,
      delivery: { ...validPayload.delivery, addressLine: 'a' },
    });
    const deliveryError = errors.find((e) => e.property === 'delivery');
    expect(deliveryError).toBeDefined();
  });

  it('rejects unknown top-level properties', async () => {
    const errors = await validateDto({ ...validPayload, extraField: 'not allowed' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
