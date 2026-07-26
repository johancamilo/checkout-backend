import { Result, DomainError } from '@domain/shared/result';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface CardData {
  number: string;
  cvc: string;
  expMonth: string;
  expYear: string;
  cardHolder: string;
}

export interface ChargeRequest {
  amountInCents: number;
  currency: string;
  reference: string; // our own transaction id, correlates with payment's reference
  customerEmail: string;
  card: CardData;
}

export interface ChargeResult {
  gatewayTransactionId: string;
  status: 'APPROVED' | 'DECLINED' | 'ERROR';
  rawStatus: string;
}

/**
 * Port that abstracts the payment gateway (payment in this implementation).
 * The domain/application layer only knows this interface; it never talks to
 * axios or payment's DTOs directly. This is what lets us swap gateways or unit
 * test use cases without hitting the network.
 */
export interface PaymentGateway {
  /** Tokenizes card data with the gateway (never persist raw card data). */
  tokenizeCard(card: CardData): Promise<Result<string, DomainError>>;

  /** Charges a previously tokenized card. */
  charge(
    request: ChargeRequest & { cardToken: string },
  ): Promise<Result<ChargeResult, DomainError>>;

  /** Retrieves the current status of a transaction from the gateway. */
  getTransactionStatus(
    gatewayTransactionId: string,
  ): Promise<Result<ChargeResult, DomainError>>;
}
