import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmPaymentDto } from './confirm-payment.dto';

const validPayload = {
  transactionId: 'txn-1',
  card: {
    number: '4242424242424242',
    cvc: '123',
    expMonth: '12',
    expYear: '29',
    cardHolder: 'Jane Doe',
  },
};

async function validateDto(payload: unknown) {
  const dto = plainToInstance(ConfirmPaymentDto, payload);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('ConfirmPaymentDto', () => {
  it('passes validation with a valid payload', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('fails when transactionId is missing', async () => {
    const errors = await validateDto({ ...validPayload, transactionId: '' });
    expect(errors.some((e) => e.property === 'transactionId')).toBe(true);
  });

  it('fails when the card number has letters or wrong length', async () => {
    const errors = await validateDto({
      ...validPayload,
      card: { ...validPayload.card, number: '4242-4242-4242' },
    });
    expect(errors.find((e) => e.property === 'card')).toBeDefined();
  });

  it('fails when expMonth is out of range', async () => {
    const errors = await validateDto({
      ...validPayload,
      card: { ...validPayload.card, expMonth: '13' },
    });
    expect(errors.find((e) => e.property === 'card')).toBeDefined();
  });

  it('fails when cvc is too short', async () => {
    const errors = await validateDto({
      ...validPayload,
      card: { ...validPayload.card, cvc: '1' },
    });
    expect(errors.find((e) => e.property === 'card')).toBeDefined();
  });

  it('fails when cardHolder is empty', async () => {
    const errors = await validateDto({
      ...validPayload,
      card: { ...validPayload.card, cardHolder: '' },
    });
    expect(errors.find((e) => e.property === 'card')).toBeDefined();
  });
});
