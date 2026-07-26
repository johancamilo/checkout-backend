import { Customer, CustomerProps } from '@domain/entities/customer.entity';
import { DomainErrorCode } from '@domain/shared/result';

describe('Customer', () => {
  const validProps: CustomerProps = {
    id: 'customer-1',
    fullName: 'Johan Camilo',
    email: 'johan@example.com',
    phoneNumber: '3001234567',
    documentNumber: '123456789',
  };

  it('creates a valid customer', () => {
    const result = Customer.create(validProps);

    expect(result.isSuccess).toBe(true);
    const customer = result.value;
    expect(customer.id).toBe(validProps.id);
    expect(customer.fullName).toBe(validProps.fullName);
    expect(customer.email).toBe(validProps.email);
    expect(customer.phoneNumber).toBe(validProps.phoneNumber);
    expect(customer.documentNumber).toBe(validProps.documentNumber);
  });

  it('fails when fullName is missing', () => {
    const result = Customer.create({ ...validProps, fullName: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error.code).toBe(DomainErrorCode.VALIDATION_ERROR);
    expect(result.error.message).toContain('at least 3 characters');
  });

  it('fails when fullName is shorter than 3 characters after trim', () => {
    const result = Customer.create({ ...validProps, fullName: ' jo ' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('at least 3 characters');
  });

  it('fails when email is invalid', () => {
    const result = Customer.create({ ...validProps, email: 'not-an-email' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('email is invalid');
  });

  it('fails when email has no domain', () => {
    const result = Customer.create({ ...validProps, email: 'johan@' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('email is invalid');
  });

  it('fails when phoneNumber is missing', () => {
    const result = Customer.create({ ...validProps, phoneNumber: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('phone number is invalid');
  });

  it('fails when phoneNumber has fewer than 7 digits', () => {
    const result = Customer.create({ ...validProps, phoneNumber: '123-45' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('phone number is invalid');
  });

  it('accepts phoneNumber with non-digit formatting as long as 7+ digits remain', () => {
    const result = Customer.create({ ...validProps, phoneNumber: '(300) 123-4567' });

    expect(result.isSuccess).toBe(true);
  });

  it('fails when documentNumber is missing', () => {
    const result = Customer.create({ ...validProps, documentNumber: '' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('document number is required');
  });

  it('fails when documentNumber is only whitespace', () => {
    const result = Customer.create({ ...validProps, documentNumber: '   ' });

    expect(result.isFailure).toBe(true);
    expect(result.error.message).toContain('document number is required');
  });

  it('toPrimitives returns a copy of the underlying props', () => {
    const customer = Customer.create(validProps).value;
    const primitives = customer.toPrimitives();

    expect(primitives).toEqual(validProps);
    expect(primitives).not.toBe(validProps);
  });
});