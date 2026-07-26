import * as crypto from 'crypto';

/**
 * Builds the "integrity signature" requires on every transaction:
 * sha256(reference + amountInCents + currency + integritySecret), hex-encoded.
 */
export function buildIntegritySignature(params: {
  reference: string;
  amountInCents: number;
  currency: string;
  integritySecret: string;
}): string {
  const concatenated = `${params.reference}${params.amountInCents}${params.currency}${params.integritySecret}`;
  return crypto.createHash('sha256').update(concatenated).digest('hex');
}

/** Detects card brand from its number (BIN ranges), for UI display purposes. */
export function detectCardBrand(cardNumber: string): 'VISA' | 'MASTERCARD' | 'UNKNOWN' {
  const digits = cardNumber.replace(/\D/g, '');
  if (/^4/.test(digits)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'MASTERCARD';
  return 'UNKNOWN';
}
