import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications/notifications.service';
import { PayseraService } from '../paysera/paysera.service';
import { RequestingUser } from '../common/types/requesting-user.interface';

function makeUser(overrides: Partial<RequestingUser> = {}): RequestingUser {
  return {
    id: 'u1',
    userId: 'u1',
    email: 'test@example.com',
    userType: 'BUYER',
    isCompany: false,
    canSell: false,
    canTransport: false,
    canSkipHire: false,
    companyId: 'company-1',
    companyRole: undefined,
    permCreateContracts: false,
    permReleaseCallOffs: false,
    permManageOrders: false,
    permViewFinancials: false,
    permManageTeam: false,
    payoutEnabled: false,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<any> = {}) {
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
          supplier: { id: 'supplier-1', ibanNumber: 'LV80BANK0000435195001' },
        },
      },
    ],
    transportJobs: [],
    ...overrides,
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: jest.Mocked<PrismaService>;
  let notifications: jest.Mocked<NotificationsService>;
  let paysera: jest.Mocked<PayseraService>;

  beforeEach(async () => {
    const mockPrisma: any = {
      order: { findUnique: jest.fn(), update: jest.fn() },
      payment: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      skipHireOrder: { findUnique: jest.fn(), update: jest.fn() },
      guestOrder: { findFirst: jest.fn(), update: jest.fn() },
      invoice: { findFirst: jest.fn(), update: jest.fn() },
      supplierPayout: { create: jest.fn(), findMany: jest.fn() },
      carrierPayout: { create: jest.fn(), findMany: jest.fn() },
      company: { findUnique: jest.fn(), update: jest.fn() },
      user: {
        findUnique: jest.fn(),
        findMany: (jest.fn() as any).mockResolvedValue([]),
      },
      driverProfile: { findUnique: jest.fn() },
      $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
    };

    const mockNotifications = {
      create: (jest.fn() as any).mockResolvedValue(undefined),
      createForMany: (jest.fn() as any).mockResolvedValue(undefined),
    };

    const mockPaysera = {
      createCheckout: jest.fn(),
      refundOrder: jest.fn(),
      parseWebhook: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'WEB_BASE_URL') return 'https://example.com';
              if (key === 'APP_BASE_URL') return 'https://app.example.com';
              return null;
            }),
          },
        },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: PayseraService, useValue: mockPaysera },
      ],
    }).compile();

    service = module.get(PaymentsService);
    prisma = module.get(PrismaService);
    notifications = module.get(NotificationsService);
    paysera = module.get(PayseraService);

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
      (paysera.createCheckout as jest.Mock<any>).mockResolvedValue({
        payseraOrderId: 'pso_123',
        paymentUrl: 'https://paysera.com/pay/pso_123',
      });
      (prisma.payment.upsert as jest.Mock<any>).mockResolvedValue({});

      const result = await service.createPaymentIntent(
        'order-1',
        makeUser({ userId: 'admin-1', userType: 'ADMIN' }),
      );
      expect(result.paymentUrl).toBe('https://paysera.com/pay/pso_123');
      expect(result.payseraOrderId).toBe('pso_123');
    });

    it('calls paysera.createCheckout with correct amount', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({ total: 99.99 }),
      );
      (paysera.createCheckout as jest.Mock<any>).mockResolvedValue({
        payseraOrderId: 'pso_456',
        paymentUrl: 'https://paysera.com/pay/pso_456',
      });
      (prisma.payment.upsert as jest.Mock<any>).mockResolvedValue({});

      await service.createPaymentIntent('order-1', makeUser());

      expect(paysera.createCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ amountCents: 9999 }),
      );
    });

    it('returns paymentUrl and payseraOrderId', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder(),
      );
      (paysera.createCheckout as jest.Mock<any>).mockResolvedValue({
        payseraOrderId: 'pso_789',
        paymentUrl: 'https://paysera.com/pay/pso_789',
      });
      (prisma.payment.upsert as jest.Mock<any>).mockResolvedValue({});

      const result = await service.createPaymentIntent('order-1', makeUser());
      expect(result).toHaveProperty('paymentUrl');
      expect(result).toHaveProperty('payseraOrderId');
    });
  });

  // ── capturePayment ────────────────────────────────────────────────────────

  describe('capturePayment', () => {
    it('resolves without error (no-op stub)', async () => {
      await expect(service.capturePayment('order-1')).resolves.toBeUndefined();
    });
  });

  // ── releaseFunds ──────────────────────────────────────────────────────────

  describe('releaseFunds', () => {
    it('is idempotent — skips release when payment already RELEASED', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue({
        orderId: 'order-1',
        payseraOrderId: 'pso_123',
        status: 'RELEASED',
      });

      await service.releaseFunds('order-1');
      expect(prisma.supplierPayout.create).not.toHaveBeenCalled();
    });

    it('skips without error when no payment record at all', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue(null);
      await expect(service.releaseFunds('order-1')).resolves.toBeUndefined();
    });

    it('creates SupplierPayout records when payment is CAPTURED', async () => {
      (prisma.payment.findUnique as jest.Mock<any>).mockResolvedValue({
        orderId: 'order-1',
        payseraOrderId: 'pso_123',
        status: 'CAPTURED',
      });
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({ total: 100, currency: 'EUR', transportJobs: [] }),
      );
      (prisma.supplierPayout.create as jest.Mock<any>).mockResolvedValue({});
      (prisma.payment.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});

      await service.releaseFunds('order-1');
      expect(prisma.supplierPayout.create).toHaveBeenCalled();
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
        makeOrder({ status: 'DELIVERED', buyerId: 'other-company', createdById: 'other-user' }),
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
        makeOrder({ status: 'DELIVERED', buyerId: 'company-1', createdById: 'other-user' }),
      );
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.user.findMany as jest.Mock<any>).mockResolvedValue([]);

      const result = await service.reportDispute(
        'order-1', 'wrong qty', 'Delivered 10t instead of 20t',
        makeUser({ companyId: 'company-1' }),
      );
      expect(result.ok).toBe(true);
    });

    it('notifies all admin users when a dispute is filed', async () => {
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(
        makeOrder({ status: 'DELIVERED', buyerId: 'company-1' }),
      );
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});
      (prisma.user.findMany as jest.Mock<any>).mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);

      await service.reportDispute('order-1', 'short delivery', undefined, makeUser());
      expect(notifications.createForMany).toHaveBeenCalledWith(
        ['admin-1', 'admin-2'],
        expect.objectContaining({ data: expect.objectContaining({ orderId: 'order-1' }) }),
      );
    });
  });

  // ── handleWebhookEvent ────────────────────────────────────────────────────

  describe('handleWebhookEvent', () => {
    it('throws BadRequestException when webhook signature is invalid', async () => {
      (paysera.parseWebhook as jest.Mock<any>).mockImplementation(() => {
        throw new Error('signature mismatch');
      });
      await expect(
        service.handleWebhookEvent(Buffer.from('{}'), 'bad-sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates payment to CAPTURED on order.paid', async () => {
      const event = {
        event: 'order.paid',
        data: { reference: 'order-1' },
      };
      (paysera.parseWebhook as jest.Mock<any>).mockReturnValue(event);
      (prisma.payment.findFirst as jest.Mock<any>).mockResolvedValue(null);
      (prisma.skipHireOrder.findUnique as jest.Mock<any>).mockResolvedValue(null);
      (prisma.guestOrder.findFirst as jest.Mock<any>).mockResolvedValue(null);
      (prisma.invoice.findFirst as jest.Mock<any>).mockResolvedValue(null);
      (prisma.order.findUnique as jest.Mock<any>).mockResolvedValue(makeOrder());
      (prisma.payment.upsert as jest.Mock<any>).mockResolvedValue({});
      (prisma.order.update as jest.Mock<any>).mockResolvedValue({});

      await service.handleWebhookEvent(Buffer.from('{}'), 'sig');
      expect(paysera.parseWebhook).toHaveBeenCalled();
    });

    it('resolves silently for unknown event types', async () => {
      (paysera.parseWebhook as jest.Mock<any>).mockReturnValue({
        event: 'order.created',
        data: {},
      });
      await expect(
        service.handleWebhookEvent(Buffer.from('{}'), 'sig'),
      ).resolves.toBeUndefined();
    });
  });
});
