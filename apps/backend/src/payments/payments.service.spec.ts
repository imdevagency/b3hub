/**
 * PaymentsService — Business Rule Tests
 *
 * Covers the key invariants for payment intent creation, fund capture,
 * fund release (seller/driver split), dispute handling, and webhook processing.
 * Stripe is fully mocked — no network calls.
 *
 * Key rules documented here:
 *  - Only the order's buyer (or an ADMIN) can create a payment intent
 *  - Capture is idempotent — already CAPTURED/RELEASED payments are skipped
 *  - Platform takes 5 % fee; driver gets 20 % of net when a delivered job exists
 *  - Dispute is limited to DELIVERED orders; only the buyer company may file
 *  - Webhook ignores events with no orderId metadata silently
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import type { RequestingUser } from '../common/types/requesting-user.interface';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<RequestingUser> = {}): RequestingUser {
  return {
    id: 'u1',
    userId: 'u1',
    email: 'buyer@example.com',
    userType: 'BUYER',
    isCompany: true,
    canSell: false,
    canTransport: false,
    canSkipHire: false,
    companyId: 'company-1',
    companyRole: 'OWNER',
    permCreateContracts: false,
    permReleaseCallOffs: false,
    permManageOrders: true,
    permViewFinancials: true,
    permManageTeam: false,
    ...overrides,
  };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'ORD-001',
    createdById: 'u1',
    buyerId: 'company-1',
    total: 200,
    currency: 'EUR',
    status: 'DELIVERED',
    paymentStatus: 'AUTHORIZED',
    internalNotes: null,
    items: [
      {
        material: {
          supplier: { id: 'supplier-1', stripeConnectId: 'acct_supplier' },
        },
      },
    ],
    transportJobs: [],
    ...overrides,
  };
}

// ── Fixture setup ─────────────────────────────────────────────────────────────

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: jest.Mocked<PrismaService>;
  let notifications: jest.Mocked<NotificationsService>;

  // Stripe mock returned from stripe() constructor
  const stripeIntentsMock = {
    create: jest.fn<any>(),
    retrieve: jest.fn<any>(),
    capture: jest.fn<any>(),
  };
  const stripeTransfersMock = { create: jest.fn<any>() };
  const stripeAccountsMock = { create: jest.fn<any>() };
  const stripeAccountLinksMock = { create: jest.fn<any>() };
  const stripeWebhooksMock = { constructEvent: jest.fn<any>() };

  // We intercept the Stripe class constructor via ConfigService returning a key
  beforeEach(async () => {
    const mockPrisma: any = {
      order: {
        findUnique: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      payment: {
        findUnique: jest.fn<any>(),
        findFirst: jest.fn<any>(),
        upsert: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      company: {
        findUnique: jest.fn<any>(),
        update: jest.fn<any>(),
      },
      user: {
        findUnique: jest.fn<any>(),
        findMany: (jest.fn() as any).mockResolvedValue([]),
      },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };

    const mockNotifications = {
      create: (jest.fn() as any).mockResolvedValue(undefined),
      createForMany: (jest.fn() as any).mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_fake';
              if (key === 'STRIPE_PUBLISHABLE_KEY') return 'pk_test_fake';
              if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_fake';
              if (key === 'WEB_BASE_URL') return 'https://example.com';
              return null;
            }),
          },
        },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(PaymentsService);
    prisma = module.get(PrismaService);
    notifications = module.get(NotificationsService);

    // Patch the private stripe instance with our mock

    (service as any).stripe = {
      paymentIntents: stripeIntentsMock,
      transfers: stripeTransfersMock,
      accounts: stripeAccountsMock,
      accountLinks: stripeAccountLinksMock,
      webhooks: stripeWebhooksMock,
    };

    jest.clearAllMocks();
  });

  // ── createPaymentIntent ───────────────────────────────────────────────────

  describe('createPaymentIntent', () => {
    it('throws BadRequestException when order not found', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(null);
      await expect(
        service.createPaymentIntent('nonexistent', makeUser()),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when caller is not the order buyer and not ADMIN', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({ createdById: 'other-user' }),
      );
      await expect(
        service.createPaymentIntent('order-1', makeUser({ userId: 'u1' })),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows ADMIN to create payment intent for any order', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({ createdById: 'other-user' }),
      );
      stripeIntentsMock.create.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'secret_abc',
      });
      (prisma.payment.upsert as jest.Mock<any>).mockResolvedValue({});

      const result = await service.createPaymentIntent(
        'order-1',
        makeUser({ userId: 'admin-1', userType: 'ADMIN' }),
      );
      expect(result.clientSecret).toBe('secret_abc');
    });

    it('creates a PaymentIntent with capture_method = manual', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder(),
      );
      stripeIntentsMock.create.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'secret_abc',
      });
      (prisma.payment.upsert as jest.Mock<any>).mockResolvedValue({});

      await service.createPaymentIntent('order-1', makeUser());

      expect(stripeIntentsMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ capture_method: 'manual' }),
      );
    });

    it('returns clientSecret and publishableKey', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder(),
      );
      stripeIntentsMock.create.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'cs_test',
      });
      (prisma.payment.upsert as jest.Mock<any>).mockResolvedValue({});

      const result = await service.createPaymentIntent('order-1', makeUser());
      expect(result).toHaveProperty('clientSecret', 'cs_test');
      expect(result).toHaveProperty('publishableKey', 'pk_test_fake');
    });

    it('converts total to cents when creating the intent', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({ total: 99.99 }),
      );
      stripeIntentsMock.create.mockResolvedValue({
        id: 'pi_123',
        client_secret: 'cs_test',
      });
      (prisma.payment.upsert as jest.Mock<any>).mockResolvedValue({});

      await service.createPaymentIntent('order-1', makeUser());
      // 99.99 * 100 rounded = 9999 cents
      expect(stripeIntentsMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 9999 }),
      );
    });
  });

  // ── capturePayment ────────────────────────────────────────────────────────

  describe('capturePayment', () => {
    it('throws BadRequestException when no payment record exists', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue(null);
      await expect(service.capturePayment('order-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('is idempotent — skips capture when status is already CAPTURED', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue({
        orderId: 'order-1',
        stripePaymentId: 'pi_123',
        status: 'CAPTURED',
      });

      await service.capturePayment('order-1');
      expect(stripeIntentsMock.capture).not.toHaveBeenCalled();
    });

    it('is idempotent — skips capture when status is already RELEASED', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue({
        orderId: 'order-1',
        stripePaymentId: 'pi_123',
        status: 'RELEASED',
      });

      await service.capturePayment('order-1');
      expect(stripeIntentsMock.capture).not.toHaveBeenCalled();
    });

    it('captures and updates DB when PaymentIntent succeeds', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue({
        orderId: 'order-1',
        stripePaymentId: 'pi_123',
        status: 'AUTHORIZED',
      });
      stripeIntentsMock.capture.mockResolvedValue({ status: 'succeeded' });
      (prisma.$transaction as jest.Mock<any>).mockResolvedValue([{}, {}]);

      await service.capturePayment('order-1');
      expect(stripeIntentsMock.capture).toHaveBeenCalledWith('pi_123');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── releaseFunds ──────────────────────────────────────────────────────────

  describe('releaseFunds', () => {
    const basePayment = {
      orderId: 'order-1',
      stripePaymentId: 'pi_123',
      stripeChargeId: 'ch_123',
      status: 'CAPTURED',
    };

    it('is idempotent — skips release when payment already RELEASED', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue({
        ...basePayment,
        status: 'RELEASED',
      });

      await service.releaseFunds('order-1');
      expect(stripeTransfersMock.create).not.toHaveBeenCalled();
    });

    it('skips without error when no payment record at all', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue(null);
      await expect(service.releaseFunds('order-1')).resolves.toBeUndefined();
    });

    it('calculates 5 % platform fee from total', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue(
        basePayment,
      );
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({ total: 100, currency: 'EUR', transportJobs: [] }),
      );
      stripeTransfersMock.create.mockResolvedValue({ id: 't_1' });
      (prisma.payment.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});

      await service.releaseFunds('order-1');

      // platformFee = 5 % of 100 = 5 → sellerCents = 9500
      const call = (stripeTransfersMock.create as jest.Mock<any>).mock
        .calls[0][0] as {
        amount: number;
      };
      expect(call.amount).toBe(9500);
    });

    it('allocates 20 % of net to driver when a DELIVERED transport job exists', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue(
        basePayment,
      );
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({
          total: 100,
          currency: 'EUR',
          transportJobs: [
            {
              driverId: 'driver-1',
              driver: {
                id: 'driver-1',
                companyId: 'carrier-1',
                company: { stripeConnectId: 'acct_driver' },
              },
            },
          ],
        }),
      );
      stripeTransfersMock.create.mockResolvedValue({ id: 't_1' });
      (prisma.payment.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});

      await service.releaseFunds('order-1');

      const calls = (stripeTransfersMock.create as jest.Mock<any>).mock
        .calls as Array<[{ amount: number; destination: string }]>;
      const driverCall = calls.find(([c]) => c.destination === 'acct_driver');
      expect(driverCall).toBeDefined();
      // net = 9500 cents; driver share = 20 % = 1900
      expect(driverCall![0].amount).toBe(1900);
    });

    it('sends 100 % of net to seller when there is no driver', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue(
        basePayment,
      );
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({ total: 100, currency: 'EUR', transportJobs: [] }),
      );
      stripeTransfersMock.create.mockResolvedValue({ id: 't_1' });
      (prisma.payment.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});

      await service.releaseFunds('order-1');

      // Only one transfer (to supplier), no driver transfer
      expect(stripeTransfersMock.create).toHaveBeenCalledTimes(1);
      const call = (stripeTransfersMock.create as jest.Mock<any>).mock
        .calls[0][0] as { amount: number };
      expect(call.amount).toBe(9500);
    });

    it('marks payment as RELEASED in DB after successful transfers', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue(
        basePayment,
      );
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({ total: 50, currency: 'EUR', transportJobs: [] }),
      );
      stripeTransfersMock.create.mockResolvedValue({ id: 't_1' });
      (prisma.payment.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});

      await service.releaseFunds('order-1');

      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RELEASED' }),
        }),
      );
    });
  });

  // ── reportDispute ─────────────────────────────────────────────────────────

  describe('reportDispute', () => {
    it('throws NotFoundException when order does not exist', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(null);
      await expect(
        service.reportDispute('nope', 'wrong qty', undefined, makeUser()),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is not the buyer', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({
          status: 'DELIVERED',
          buyerId: 'other-company',
          createdById: 'other-user',
        }),
      );
      await expect(
        service.reportDispute('order-1', 'wrong qty', undefined, makeUser()),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when order is not DELIVERED', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({ status: 'CONFIRMED', buyerId: 'company-1' }),
      );
      await expect(
        service.reportDispute('order-1', 'bad material', undefined, makeUser()),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows dispute when caller belongs to buyer company', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({
          status: 'DELIVERED',
          buyerId: 'company-1',
          createdById: 'other-user',
        }),
      );
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.user.findMany as jest.Mock<any>).mockResolvedValue([]);

      const result = await service.reportDispute(
        'order-1',
        'wrong qty',
        'Delivered 10t instead of 20t',
        makeUser({ companyId: 'company-1' }),
      );
      expect(result.ok).toBe(true);
    });

    it('allows dispute when caller is the order creator (solo user)', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({
          status: 'DELIVERED',
          buyerId: 'other-company',
          createdById: 'u1',
        }),
      );
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.user.findMany as jest.Mock<any>).mockResolvedValue([]);

      const result = await service.reportDispute(
        'order-1',
        'damaged',
        undefined,
        makeUser({ userId: 'u1' }),
      );
      expect(result.ok).toBe(true);
    });

    it('notifies all admin users when a dispute is filed', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({ status: 'DELIVERED', buyerId: 'company-1' }),
      );
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.user.findMany as jest.Mock<any>).mockResolvedValue([
        { id: 'admin-1' },
        { id: 'admin-2' },
      ]);

      await service.reportDispute(
        'order-1',
        'short delivery',
        undefined,
        makeUser(),
      );
      expect(notifications.createForMany).toHaveBeenCalledWith(
        ['admin-1', 'admin-2'],
        expect.objectContaining({
          data: expect.objectContaining({ orderId: 'order-1' }),
        }),
      );
    });
  });

  // ── handleWebhookEvent ────────────────────────────────────────────────────

  describe('handleWebhookEvent', () => {
    it('throws BadRequestException when webhook signature is invalid', async () => {
      stripeWebhooksMock.constructEvent.mockImplementation(() => {
        throw new Error('signature mismatch');
      });
      await expect(
        service.handleWebhookEvent(Buffer.from('{}'), 'bad-sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates payment to AUTHORIZED on payment_intent.amount_capturable_updated', async () => {
      const event = {
        type: 'payment_intent.amount_capturable_updated',
        data: { object: { metadata: { orderId: 'order-1' } } },
      };
      stripeWebhooksMock.constructEvent.mockReturnValue(event);
      (prisma.payment.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});

      await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'AUTHORIZED' } }),
      );
    });

    it('updates payment to CAPTURED on payment_intent.succeeded', async () => {
      const event = {
        type: 'payment_intent.succeeded',
        data: { object: { metadata: { orderId: 'order-1' } } },
      };
      stripeWebhooksMock.constructEvent.mockReturnValue(event);
      (prisma.payment.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});

      await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'CAPTURED' } }),
      );
    });

    it('updates payment to FAILED on payment_intent.payment_failed', async () => {
      const event = {
        type: 'payment_intent.payment_failed',
        data: { object: { metadata: { orderId: 'order-1' } } },
      };
      stripeWebhooksMock.constructEvent.mockReturnValue(event);
      (prisma.payment.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});

      await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'FAILED' } }),
      );
    });

    it('silently ignores events without an orderId in metadata', async () => {
      const event = {
        type: 'payment_intent.succeeded',
        data: { object: { metadata: {} } },
      };
      stripeWebhooksMock.constructEvent.mockReturnValue(event);

      await expect(
        service.handleWebhookEvent(Buffer.from('{}'), 'sig'),
      ).resolves.toBeUndefined();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('resolves silently for unknown event types', async () => {
      stripeWebhooksMock.constructEvent.mockReturnValue({
        type: 'customer.subscription.created',
        data: { object: {} },
      });
      await expect(
        service.handleWebhookEvent(Buffer.from('{}'), 'sig'),
      ).resolves.toBeUndefined();
    });
  });
});
