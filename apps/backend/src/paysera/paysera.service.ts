/**
 * PayseraService — Paysera Checkout v3 API client
 *
 * Handles all communication with the Paysera Checkout REST API:
 *   - OAuth2 token management (client credentials, cached with 5-min buffer)
 *   - Payment order creation
 *   - Payment link generation (redirect URL for buyer)
 *   - Refunds (full and partial)
 *   - Webhook HMAC-SHA256 signature verification
 *
 * Environment variables required:
 *   PAYSERA_CLIENT_ID     — OAuth2 client_id
 *   PAYSERA_CLIENT_SECRET — OAuth2 client_secret (also used for webhook signing)
 *   PAYSERA_PROJECT_ID    — Merchant project identifier
 */
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

const BASE_URL = 'https://api.paysera.com';
const TOKEN_URL = `${BASE_URL}/auth/realms/Paysera/protocol/openid-connect/token`;
const ORDERS_URL = `${BASE_URL}/merchant-order/integration/v1/orders`;
const LINKS_URL = `${BASE_URL}/checkout-payment-link/integration/v1/payment-links`;

/** 5-minute buffer before token expiry at which we request a fresh one */
const TOKEN_REFRESH_BUFFER_SECONDS = 300;

interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix epoch seconds
}

export interface PayseraOrder {
  id: string;
  status: 'pending_payment' | 'paid' | 'canceled' | 'closed';
  reference: string;
  amount: number; // minor units
  currency: string;
  createdAt: number;
  updatedAt: number;
}

export interface PayseraPaymentLink {
  id: string;
  status: 'active' | 'completed' | 'expired' | 'canceled';
  url: string;
  amount: number;
  currency: string;
  createdAt: number;
}

export interface PayseraWebhookPayload {
  event: {
    name: string; // 'order.paid' | 'order.pending_payment' | 'payment_link.completed' | ...
    type: string;
    timestamp: number;
  };
  order: {
    id: string;
    projectId: string;
    status: 'pending_payment' | 'paid' | 'canceled' | 'closed';
    amount: number;
    currency: string;
    reference: string; // our internal order reference
    amountPaid: number;
    balanceDue: number;
    createdAt: number;
    updatedAt: number;
  };
  paymentLink?: {
    id: string;
    status: string;
  };
}

@Injectable()
export class PayseraService {
  private readonly logger = new Logger(PayseraService.name);
  private tokenCache: TokenCache | null = null;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly projectId: string;
  readonly enabled: boolean;

  constructor(private config: ConfigService) {
    this.clientId = this.config.get<string>('PAYSERA_CLIENT_ID') ?? '';
    this.clientSecret = this.config.get<string>('PAYSERA_CLIENT_SECRET') ?? '';
    this.projectId = this.config.get<string>('PAYSERA_PROJECT_ID') ?? '';
    this.enabled = !!(this.clientId && this.clientSecret && this.projectId);
    if (!this.enabled) {
      this.logger.warn(
        'Paysera credentials not configured — payment features disabled',
      );
    }
  }

  // ── OAuth2 token management ───────────────────────────────────────────────

  /**
   * Returns a valid access token.
   * Caches it for ~55 min and refreshes 5 min before expiry.
   */
  async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (
      this.tokenCache &&
      this.tokenCache.expiresAt > now + TOKEN_REFRESH_BUFFER_SECONDS
    ) {
      return this.tokenCache.accessToken;
    }

    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new BadRequestException(`Paysera auth failed: ${body}`);
    }

    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: now + data.expires_in,
    };

    return data.access_token;
  }

  // ── Payment orders ────────────────────────────────────────────────────────

  /**
   * Create a Paysera payment order.
   * `reference` should be our internal order number (ORDER-XXXXXX) — used
   * to identify the order when the webhook fires.
   * `amountCents` — amount in minor units (cents). €10.00 = 1000.
   */
  async createOrder(params: {
    reference: string;
    amountCents: number;
    currency: string;
    successUrl: string;
    failureUrl: string;
    callbackUrl: string;
  }): Promise<PayseraOrder> {
    this.assertEnabled();

    const token = await this.getAccessToken();
    const body = {
      project_id: this.projectId,
      redirect_urls: {
        success_url: params.successUrl,
        failure_url: params.failureUrl,
        callback_url: params.callbackUrl,
      },
      purchase: {
        reference: params.reference,
        amount: String(params.amountCents),
        currency: params.currency.toUpperCase(),
      },
    };

    const res = await fetch(ORDERS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      this.logger.error(`Paysera createOrder failed (${res.status}): ${errBody}`);
      throw new BadRequestException(`Paysera order creation failed: ${errBody}`);
    }

    const data = (await res.json()) as PayseraOrder;
    return data;
  }

  /**
   * Create a Paysera payment link for an existing order.
   * Returns the URL the buyer should be redirected to.
   * `lifetimeSeconds` — how long the link stays active (default 24h = 86400s).
   */
  async createPaymentLink(params: {
    payseraOrderId: string;
    name: string;
    amountCents: number;
    currency?: string;
    language?: string;
    lifetimeSeconds?: number;
  }): Promise<PayseraPaymentLink> {
    this.assertEnabled();

    const token = await this.getAccessToken();
    const body = {
      order_id: params.payseraOrderId,
      name: params.name,
      lifetime: params.lifetimeSeconds ?? 86_400,
      experience: { language: params.language ?? 'lv' },
      purchase: {
        amount: params.amountCents,
      },
    };

    const res = await fetch(LINKS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      this.logger.error(`Paysera createPaymentLink failed (${res.status}): ${errBody}`);
      throw new BadRequestException(`Paysera payment link creation failed: ${errBody}`);
    }

    const data = (await res.json()) as {
      id: string;
      link: { url: string };
      status: string;
      amount: number;
      currency: string;
      createdAt: number;
    };

    return {
      id: data.id,
      status: data.status as PayseraPaymentLink['status'],
      url: data.link.url,
      amount: data.amount,
      currency: data.currency,
      createdAt: data.createdAt,
    };
  }

  /**
   * Convenience method — creates an order + payment link in one call.
   * Returns the checkout URL and the Paysera order ID.
   */
  async createCheckout(params: {
    reference: string;
    name: string;
    amountCents: number;
    currency: string;
    successUrl: string;
    failureUrl: string;
    callbackUrl: string;
    language?: string;
    lifetimeSeconds?: number;
  }): Promise<{ payseraOrderId: string; paymentUrl: string }> {
    const order = await this.createOrder({
      reference: params.reference,
      amountCents: params.amountCents,
      currency: params.currency,
      successUrl: params.successUrl,
      failureUrl: params.failureUrl,
      callbackUrl: params.callbackUrl,
    });

    const link = await this.createPaymentLink({
      payseraOrderId: order.id,
      name: params.name,
      amountCents: params.amountCents,
      currency: params.currency,
      language: params.language,
      lifetimeSeconds: params.lifetimeSeconds,
    });

    return { payseraOrderId: order.id, paymentUrl: link.url };
  }

  // ── Refunds ───────────────────────────────────────────────────────────────

  /**
   * Issue a full or partial refund for a Paysera order.
   * The order must be in `paid` status.
   */
  async refundOrder(params: {
    payseraOrderId: string;
    amountCents: number;
    currency: string;
    reason?: string;
  }): Promise<{ id: string; status: string }> {
    this.assertEnabled();

    const token = await this.getAccessToken();
    const url = `${ORDERS_URL}/${params.payseraOrderId}/refunds`;
    const body: Record<string, string> = {
      amount: String(params.amountCents),
      currency: params.currency.toUpperCase(),
    };
    if (params.reason) body.reason = params.reason;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      this.logger.error(`Paysera refund failed (${res.status}): ${errBody}`);
      throw new BadRequestException(`Paysera refund failed: ${errBody}`);
    }

    const data = (await res.json()) as { id: string; status: string };
    return data;
  }

  // ── Webhook signature verification ────────────────────────────────────────

  /**
   * Verify the HMAC-SHA256 signature on an incoming Paysera webhook.
   * Uses constant-time comparison to prevent timing attacks.
   *
   * @param rawBody  - Raw request body Buffer (must not be parsed)
   * @param signature - Value from `X-Paysera-Signature` header
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    if (!this.clientSecret) return false;

    const expected = createHmac('sha256', this.clientSecret)
      .update(rawBody)
      .digest('hex');

    try {
      return timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      );
    } catch {
      // If signature is not valid hex, buffers would have different lengths
      return false;
    }
  }

  /**
   * Parse and verify a webhook payload.
   * Throws BadRequestException if signature is invalid.
   */
  parseWebhook(rawBody: Buffer, signature: string): PayseraWebhookPayload {
    if (!this.verifyWebhookSignature(rawBody, signature)) {
      throw new BadRequestException('Paysera webhook signature invalid');
    }
    return JSON.parse(rawBody.toString('utf8')) as PayseraWebhookPayload;
  }

  // ── Mass Payments (IBAN transfers to suppliers / drivers) ────────────────

  /**
   * Send a SEPA credit transfer via Paysera Mass Payments API.
   * Used for NET-30 supplier and carrier payouts.
   *
   * @see https://developers.paysera.com/en/transfers/
   */
  async sendTransfer(params: {
    /** Beneficiary IBAN (e.g. LV97HABA0012345678910) */
    iban: string;
    /** Legal name of the beneficiary (shown on bank statement) */
    beneficiaryName: string;
    /** Amount in minor currency units (cents) */
    amountCents: number;
    /** ISO 4217 currency code (e.g. EUR) */
    currency: string;
    /** Unique reference — appears on the beneficiary's bank statement */
    reference: string;
    /** Optional payment description */
    description?: string;
  }): Promise<{ id: string; status: string }> {
    this.assertEnabled();

    const token = await this.getAccessToken();
    const url = `${BASE_URL}/transfer/rest/v1/transfers`;

    const body = {
      payments: [
        {
          beneficiary: {
            name: params.beneficiaryName,
            iban: params.iban.replace(/\s/g, ''),
          },
          amount: {
            amount: String(params.amountCents),
            currency: params.currency.toUpperCase(),
          },
          reference: params.reference.slice(0, 35), // SEPA max 35 chars
          purpose: (params.description ?? params.reference).slice(0, 140),
        },
      ],
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      this.logger.error(`Paysera sendTransfer failed (${res.status}): ${errBody}`);
      throw new BadRequestException(`Paysera transfer failed: ${errBody}`);
    }

    const data = (await res.json()) as { id: string; status: string };
    this.logger.log(
      `Paysera transfer sent: ${data.id} (${params.amountCents / 100} ${params.currency}) → ${params.iban}`,
    );
    return data;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new BadRequestException(
        'Paysera is not configured — set PAYSERA_CLIENT_ID, PAYSERA_CLIENT_SECRET, PAYSERA_PROJECT_ID',
      );
    }
  }
}
