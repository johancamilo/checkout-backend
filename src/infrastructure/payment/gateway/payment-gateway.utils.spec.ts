import { buildIntegritySignature, detectCardBrand } from './payment-gateway.utils';
import * as crypto from 'crypto';

describe('payment.utils', () => {
  describe('buildIntegritySignature', () => {
    it('matches the sha256(reference+amount+currency+secret) formula from payment docs', () => {
      const params = {
        reference: 'ORDER-2024-001',
        amountInCents: 5000000,
        currency: 'COP',
        integritySecret: 'test_integrity_secret',
      };
      const expected = crypto
        .createHash('sha256')
        .update(`${params.reference}${params.amountInCents}${params.currency}${params.integritySecret}`)
        .digest('hex');

      expect(buildIntegritySignature(params)).toBe(expected);
    });

    it('produces different signatures for different references', () => {
      const base = { amountInCents: 100, currency: 'COP', integritySecret: 'secret' };
      const sigA = buildIntegritySignature({ ...base, reference: 'A' });
      const sigB = buildIntegritySignature({ ...base, reference: 'B' });
      expect(sigA).not.toBe(sigB);
    });
  });

  describe('detectCardBrand', () => {
    it('detects VISA numbers (starting with 4)', () => {
      expect(detectCardBrand('4242424242424242')).toBe('VISA');
    });

    it('detects MASTERCARD numbers (51-55 range)', () => {
      expect(detectCardBrand('5105105105105100')).toBe('MASTERCARD');
    });

    it('returns UNKNOWN for unrecognized brands', () => {
      expect(detectCardBrand('6011000000000004')).toBe('UNKNOWN');
    });
  });
});
