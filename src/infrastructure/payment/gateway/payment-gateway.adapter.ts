import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { Result, DomainError } from '@domain/shared/result';
import {
  CardData,
  ChargeRequest,
  ChargeResult,
  PaymentGateway,
} from '@domain/ports/payment-gateway.port';
import { AppConfig } from '@config/app.config';
import { buildIntegritySignature } from './payment-gateway.utils';

interface GatewayAcceptanceTokens {
  acceptanceToken: string;
  acceptPersonalAuth: string;
}

const POLL_MAX_ATTEMPTS = 6;
const POLL_DELAY_MS = 1000;

@Injectable()
export class PaymentGatewayAdapter implements PaymentGateway {
  private readonly logger = new Logger(PaymentGatewayAdapter.name);
  private readonly http: AxiosInstance;
  private cachedAcceptanceTokens: GatewayAcceptanceTokens | null = null;

  constructor(private readonly config: AppConfig) {
    this.http = axios.create({ baseURL: config.paymentGateway.baseUrl, timeout: 10000 });
  }

  async tokenizeCard(card: CardData): Promise<Result<string, DomainError>> {
    try {
      const response = await this.http.post(
        '/tokens/cards',
        {
          number: card.number.replace(/\s/g, ''),
          cvc: card.cvc,
          exp_month: card.expMonth,
          exp_year: card.expYear,
          card_holder: card.cardHolder,
        },
        { headers: this.publicAuthHeader() },
      );
      const token = response.data?.data?.id;
      if (!token) {
        return Result.fail(
          DomainError.paymentGatewayError('Payment did not return a card token'),
        );
      }
      return Result.ok(token);
    } catch (err) {
      return Result.fail(this.mapAxiosError(err, 'tokenizing card'));
    }
  }

  async charge(
    request: ChargeRequest & { cardToken: string },
  ): Promise<Result<ChargeResult, DomainError>> {
    const tokensResult = await this.getAcceptanceTokens();
    if (tokensResult.isFailure) {
      return Result.fail(tokensResult.error);
    }

    const signature = buildIntegritySignature({
      reference: request.reference,
      amountInCents: request.amountInCents,
      currency: request.currency,
      integritySecret: this.config.paymentGateway.integritySecret,
    });

    try {
      const response = await this.http.post(
        '/transactions',
        {
          amount_in_cents: request.amountInCents,
          currency: request.currency,
          customer_email: request.customerEmail,
          reference: request.reference,
          signature,
          acceptance_token: tokensResult.value.acceptanceToken,
          accept_personal_auth: tokensResult.value.acceptPersonalAuth,
          payment_method: {
            type: 'CARD',
            token: request.cardToken,
            installments: 1,
          },
        },
        { headers: this.privateAuthHeader() },
      );

      const transactionId = response.data?.data?.id;
      const status = response.data?.data?.status as string | undefined;
      if (!transactionId || !status) {
        return Result.fail(
          DomainError.paymentGatewayError('Unexpected response creating payment transaction'),
        );
      }

      // Payment may return PENDING immediately; poll until a final status
      // (APPROVED/DECLINED/ERROR) or we give up.
      const finalStatus = await this.pollUntilFinal(transactionId, status);
      return Result.ok({
        gatewayTransactionId: transactionId,
        status: this.mapStatus(finalStatus),
        rawStatus: finalStatus,
      });
    } catch (err) {
      return Result.fail(this.mapAxiosError(err, 'creating payment transaction'));
    }
  }

  async getTransactionStatus(
    gatewayTransactionId: string,
  ): Promise<Result<ChargeResult, DomainError>> {
    try {
      const response = await this.http.get(`/transactions/${gatewayTransactionId}`, {
        headers: this.publicAuthHeader(),
      });
      const status = response.data?.data?.status as string;
      return Result.ok({
        gatewayTransactionId,
        status: this.mapStatus(status),
        rawStatus: status,
      });
    } catch (err) {
      return Result.fail(this.mapAxiosError(err, 'fetching payment transaction status'));
    }
  }

  private async pollUntilFinal(
    transactionId: string,
    initialStatus: string,
  ): Promise<string> {
    let currentStatus = initialStatus;
    let attempts = 0;
    while (currentStatus === 'PENDING' && attempts < POLL_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
      try {
        const response = await this.http.get(`/transactions/${transactionId}`, {
          headers: this.publicAuthHeader(),
        });
        currentStatus = response.data?.data?.status ?? currentStatus;
      } catch (err) {
        this.logger.warn(`Polling payment transaction ${transactionId} failed: ${err}`);
        break;
      }
      attempts += 1;
    }
    return currentStatus;
  }

  private async getAcceptanceTokens(): Promise<Result<GatewayAcceptanceTokens, DomainError>> {
    try {
      const response = await this.http.get(`/merchants/${this.config.paymentGateway.publicKey}`);
      const acceptanceToken = response.data?.data?.presigned_acceptance?.acceptance_token;
      const acceptPersonalAuth =
        response.data?.data?.presigned_personal_data_auth?.acceptance_token ?? '';
      if (!acceptanceToken) {
        return Result.fail(
          DomainError.paymentGatewayError('Could not retrieve payment acceptance token'),
        );
      }
      return Result.ok({ acceptanceToken, acceptPersonalAuth });
    } catch (err) {
      return Result.fail(this.mapAxiosError(err, 'fetching payment acceptance tokens'));
    }
  }

  private mapStatus(status: string): 'APPROVED' | 'DECLINED' | 'ERROR' {
    if (status === 'APPROVED') return 'APPROVED';
    if (status === 'DECLINED') return 'DECLINED';
    return 'ERROR'; // PENDING (after exhausting polls), ERROR, VOIDED, etc.
  }

  private publicAuthHeader() {
    return { Authorization: `Bearer ${this.config.paymentGateway.publicKey}` };
  }

  private privateAuthHeader() {
    return { Authorization: `Bearer ${this.config.paymentGateway.privateKey}` };
  }

  private mapAxiosError(err: unknown, context: string): DomainError {
    if (axios.isAxiosError(err)) {
      const message =
        err.response?.data?.error?.messages
          ? JSON.stringify(err.response.data.error.messages)
          : err.message;
      this.logger.error(`payment error while ${context}: ${message}`);
      return DomainError.paymentGatewayError(`payment error while ${context}: ${message}`);
    }
    this.logger.error(`Unexpected error while ${context}: ${err}`);
    return DomainError.paymentGatewayError(`Unexpected error while ${context}`);
  }
}
