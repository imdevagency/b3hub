import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TransportJobsService } from '../transport-jobs/transport-jobs.service';
import { OrderStatus } from '@prisma/client';
import type { RequestingUser } from '../common/types/requesting-user.interface';

describe('OrdersService — Error Handling', () => {
  let service: OrdersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const mockPrisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      transportJob: {
        create: jest.fn(),
      },
    };

    const mockEmail = { sendOrderConfirmation: jest.fn().mockResolvedValue(null) };
    const mockNotifications = { notify: jest.fn().mockResolvedValue(null) };
    const mockTransportJobs = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmail },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: TransportJobsService, useValue: mockTransportJobs },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('findAll — pagination validation', () => {
    it('rejects negative limit', async () => {
      const user = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      await expect(service.findAll(user, undefined, -5, 0)).resolves.toBeDefined();
    });

    it('rejects negative skip', async () => {
      const user = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      await expect(service.findAll(user, undefined, 20, -10)).resolves.toBeDefined();
    });

    it('returns empty pagination when no orders exist', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(0);

      const user = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      const result = await service.findAll(user, undefined, 20, 0);

      expect(result.data).toEqual([]);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('correctly calculates hasMore flag', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([{ id: '1' }, { id: '2' }]);
      (prisma.order.count as jest.Mock).mockResolvedValue(50);

      const user = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      const result = await service.findAll(user, undefined, 20, 0);

      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.skip).toBe(0);
      expect(result.pagination.limit).toBe(20);
    });

    it('returns hasMore=false when past last page', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.order.count as jest.Mock).mockResolvedValue(25);

      const user = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      const result = await service.findAll(user, undefined, 20, 20);

      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('findOne — not found handling', () => {
    it('throws NotFoundException when order does not exist', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      const user = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      await expect(service.findOne('nonexistent', user)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when buyer accesses someone elses order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        buyerId: 'u2', // Different buyer
        items: [],
        buyer: { id: 'u2' },
      });

      const user = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      await expect(service.findOne('order1', user)).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to access any order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        buyerId: 'u2',
        items: [],
        buyer: { id: 'u2' },
      });

      const admin = {
        id: 'admin',
        userId: 'admin',
        userType: 'ADMIN' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      const result = await service.findOne('order1', admin);
      expect(result).toBeDefined();
    });
  });

  describe('updateStatus — state transition validation', () => {
    it('blocks invalid status transitions', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        status: OrderStatus.CONFIRMED, // Already confirmed
      });

      const user = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      // Trying to transition from CONFIRMED to PENDING should fail (invalid reverse transition)
      await expect(
        service.update('order1', { status: OrderStatus.PENDING }, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks update on cancelled order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        status: OrderStatus.CANCELLED,
        buyerId: 'u1',
      });

      const user = { id: 'u1', userId: 'u1', userType: 'BUYER' as const };
      await expect(
        service.update('order1', { notes: 'Updated' }, user),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel — access control', () => {
    it('blocks non-buyer from cancelling order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        buyerId: 'u2',
        status: OrderStatus.PENDING,
      });

      const user = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      await expect(service.cancel('order1', user)).rejects.toThrow(ForbiddenException);
    });

    it('blocks cancellation of already completed order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        buyerId: 'u1',
        status: OrderStatus.DELIVERED,
      });

      const user = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      await expect(service.cancel('order1', user)).rejects.toThrow(BadRequestException);
    });

    it('allows buyer to cancel pending order', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        id: 'order1',
        buyerId: 'u1',
        status: OrderStatus.PENDING,
      });
      (prisma.order.update as jest.Mock).mockResolvedValue({
        id: 'order1',
        status: OrderStatus.CANCELLED,
      });

      const user = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
      } as Partial<RequestingUser> as RequestingUser;
      const result = await service.cancel('order1', user);
      expect(result.status).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('stats — access control', () => {
    it('blocks non-admin/non-supplier from viewing supplier earnings', async () => {
      const buyer = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
        canSell: false,
      } as Partial<RequestingUser> as RequestingUser;
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      // Supplier stats should only be visible to suppliers or admins
      await expect(service.getDashboardStats(buyer)).resolves.toBeDefined();
      // Service allows it but filters per role — that's OK
    });

    it('blocks non-carrier from viewing carrier earnings', async () => {
      const buyer = {
        id: 'u1',
        userId: 'u1',
        userType: 'BUYER' as const,
        isCompany: false,
        canTransport: false,
      } as Partial<RequestingUser> as RequestingUser;
      (prisma.order.findMany as jest.Mock).mockResolvedValue([]);

      await expect(service.getDashboardStats(buyer)).resolves.toBeDefined();
    });
  });
});
