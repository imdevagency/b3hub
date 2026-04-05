/**
 * FrameworkContractsService — Business Rule Tests
 *
 * Covers ownership guards, call-off quantity contingent enforcement,
 * the progressPct formatting logic, and the activate/create lifecycle.
 *
 * Key rules documented here:
 *  - Only the buyer side (creator or buyer company) and the supplier company
 *    may access a contract — everyone else gets ForbiddenException
 *  - A company account is required to create a contract
 *  - Call-offs cannot exceed the position's agreedQty (across non-CANCELLED jobs)
 *  - Cancelling a call-off (status = CANCELLED) does not count toward consumption
 *  - formatContract derives progressPct = consumedQty / agreedQty * 100, capped at 100
 *  - Only the buyer side can activate a DRAFT contract
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FrameworkContractsService } from './framework-contracts.service';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { FrameworkContractStatus, TransportJobStatus } from '@prisma/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function stubContract(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fc-1',
    contractNumber: 'FC26-0001',
    title: 'Test Contract',
    status: FrameworkContractStatus.DRAFT,
    buyerId: 'company-buyer',
    supplierId: 'company-supplier',
    createdById: 'user-buyer',
    startDate: new Date('2026-01-01'),
    endDate: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    positions: [],
    callOffJobs: [],
    _count: { callOffJobs: 0 },
    ...overrides,
  };
}

function stubPosition(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pos-1',
    contractId: 'fc-1',
    positionType: 'MATERIAL_DELIVERY',
    description: 'Sand delivery',
    agreedQty: 100,
    unit: 't',
    unitPrice: 12,
    pickupAddress: 'Quarry Rd 1',
    pickupCity: 'Riga',
    deliveryAddress: 'Site A',
    deliveryCity: 'Riga',
    callOffs: [],
    ...overrides,
  };
}

// ── Fixture ───────────────────────────────────────────────────────────────────

describe('FrameworkContractsService', () => {
  let service: FrameworkContractsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma: any = {
      frameworkContract: {
        findUnique: jest.fn<any>(),
        findMany: (jest.fn() as any).mockResolvedValue([]),
        create: jest.fn<any>(),
        update: jest.fn<any>(),
        count: (jest.fn() as any).mockResolvedValue(0),
      },
      frameworkPosition: {
        create: jest.fn<any>(),
        findFirst: jest.fn<any>(),
        delete: jest.fn<any>(),
      },
      transportJob: {
        create: jest.fn<any>(),
        count: (jest.fn() as any).mockResolvedValue(0),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        FrameworkContractsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InvoicesService, useValue: { createForCallOff: jest.fn<any>() } },
      ],
    }).compile();

    service = module.get(FrameworkContractsService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;

    jest.clearAllMocks();
  });

  // ── assertOwner / access control ─────────────────────────────────────────

  describe('access control (assertOwner)', () => {
    it('throws NotFoundException when contract does not exist', async () => {
      (prisma.frameworkContract.findUnique as jest.Mock<any>).mockResolvedValue(null);
      await expect(
        service.findOne('missing', 'u1', 'company-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when caller is unrelated to the contract', async () => {
      (prisma.frameworkContract.findUnique as jest.Mock<any>).mockResolvedValue(
        stubContract({ buyerId: 'other-buyer', supplierId: 'other-supplier', createdById: 'other-user' }),
      );
      // Second call (inside findOne) also needs to be stubbed
      (prisma.frameworkContract.findUnique as jest.Mock<any>)
        .mockResolvedValueOnce(stubContract({ buyerId: 'other-buyer', supplierId: 'other-supplier', createdById: 'other-user' }));

      await expect(
        service.findOne('fc-1', 'stranger', 'stranger-company'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('grants access to the buyer who created the contract', async () => {
      const c = stubContract();
      (prisma.frameworkContract.findUnique as jest.Mock<any>).mockResolvedValue(c);
      await expect(
        service.findOne('fc-1', 'user-buyer', 'company-buyer'),
      ).resolves.toBeDefined();
    });

    it('grants access to the supplier company', async () => {
      const c = stubContract();
      (prisma.frameworkContract.findUnique as jest.Mock<any>).mockResolvedValue(c);
      await expect(
        service.findOne('fc-1', 'supplier-user', 'company-supplier'),
      ).resolves.toBeDefined();
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws BadRequestException when caller has no company', async () => {
      await expect(
        service.create(
          { title: 'Test', startDate: '2026-01-01', positions: [] },
          'u1',
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates contract with DRAFT status', async () => {
      const created = stubContract();
      (prisma.frameworkContract.create as jest.Mock<any>).mockResolvedValue(created);

      await service.create(
        { title: 'Test', startDate: '2026-01-01', positions: [] },
        'user-buyer',
        'company-buyer',
      );
      expect(prisma.frameworkContract.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: FrameworkContractStatus.DRAFT,
          }),
        }),
      );
    });
  });

  // ── activate ──────────────────────────────────────────────────────────────

  describe('activate', () => {
    it('updates status to ACTIVE', async () => {
      const c = stubContract();
      (prisma.frameworkContract.findUnique as jest.Mock<any>).mockResolvedValue(c);
      const activated = stubContract({ status: FrameworkContractStatus.ACTIVE });
      (prisma.frameworkContract.update as jest.Mock<any>).mockResolvedValue(activated);

      const result = await service.activate('fc-1', 'user-buyer', 'company-buyer');
      expect(result.status).toBe(FrameworkContractStatus.ACTIVE);
    });

    it('throws ForbiddenException when supplier tries to activate', async () => {
      // supplier matches supplierId but not buyerId/createdById
      (prisma.frameworkContract.findUnique as jest.Mock<any>).mockResolvedValue(
        stubContract(), // buyerId = 'company-buyer', supplierId = 'company-supplier'
      );
      await expect(
        service.activate('fc-1', 'supplier-user', 'company-supplier'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── createCallOff — quantity contingent ──────────────────────────────────

  describe('createCallOff', () => {
    const callOffDto = {
      quantity: 30,
      pickupDate: '2026-06-01',
      deliveryDate: '2026-06-02',
    };

    it('throws NotFoundException when position does not belong to the contract', async () => {
      (prisma.frameworkContract.findUnique as jest.Mock<any>).mockResolvedValue(stubContract());
      (prisma.frameworkPosition.findFirst as jest.Mock<any>).mockResolvedValue(null);

      await expect(
        service.createCallOff('fc-1', 'pos-missing', callOffDto, 'user-buyer', 'company-buyer'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when call-off quantity exceeds remaining agreedQty', async () => {
      (prisma.frameworkContract.findUnique as jest.Mock<any>).mockResolvedValue(stubContract());
      (prisma.frameworkPosition.findFirst as jest.Mock<any>).mockResolvedValue(
        stubPosition({
          agreedQty: 100,
          callOffs: [
            { status: 'DELIVERED', cargoWeight: 80 }, // 80 consumed, 20 remaining
          ],
        }),
      );

      await expect(
        service.createCallOff('fc-1', 'pos-1', { ...callOffDto, quantity: 21 }, 'user-buyer', 'company-buyer'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows call-off when quantity exactly matches remaining', async () => {
      (prisma.frameworkContract.findUnique as jest.Mock<any>).mockResolvedValue(stubContract());
      (prisma.frameworkPosition.findFirst as jest.Mock<any>).mockResolvedValue(
        stubPosition({
          agreedQty: 100,
          callOffs: [{ status: 'DELIVERED', cargoWeight: 80 }],
        }),
      );
      (prisma.transportJob.count as jest.Mock<any>).mockResolvedValue(5);
      (prisma.transportJob.create as jest.Mock<any>).mockResolvedValue({
        id: 'tj-1',
        jobNumber: 'TJ-000006',
        cargoWeight: 20,
        status: TransportJobStatus.AVAILABLE,
        pickupDate: new Date(),
        deliveryDate: new Date(),
        pickupCity: 'Riga',
        deliveryCity: 'Riga',
      });

      await expect(
        service.createCallOff('fc-1', 'pos-1', { ...callOffDto, quantity: 20 }, 'user-buyer', 'company-buyer'),
      ).resolves.toBeDefined();
    });

    it('excludes CANCELLED call-offs from consumed quantity', async () => {
      (prisma.frameworkContract.findUnique as jest.Mock<any>).mockResolvedValue(stubContract());
      // 50 delivered + 50 cancelled → only 50 consumed → 50 remaining
      (prisma.frameworkPosition.findFirst as jest.Mock<any>).mockResolvedValue(
        stubPosition({
          agreedQty: 100,
          callOffs: [
            { status: 'DELIVERED', cargoWeight: 50 },
            { status: 'CANCELLED', cargoWeight: 50 },
          ],
        }),
      );
      (prisma.transportJob.count as jest.Mock<any>).mockResolvedValue(2);
      (prisma.transportJob.create as jest.Mock<any>).mockResolvedValue({
        id: 'tj-2',
        jobNumber: 'TJ-000003',
        cargoWeight: 50,
        status: TransportJobStatus.AVAILABLE,
        pickupDate: new Date(),
        deliveryDate: new Date(),
        pickupCity: 'Riga',
        deliveryCity: 'Riga',
      });

      await expect(
        service.createCallOff('fc-1', 'pos-1', { ...callOffDto, quantity: 50 }, 'user-buyer', 'company-buyer'),
      ).resolves.toBeDefined();
    });

    it('creates the call-off as a TransportJob with AVAILABLE status', async () => {
      (prisma.frameworkContract.findUnique as jest.Mock<any>).mockResolvedValue(stubContract());
      (prisma.frameworkPosition.findFirst as jest.Mock<any>).mockResolvedValue(
        stubPosition({ callOffs: [] }),
      );
      (prisma.transportJob.count as jest.Mock<any>).mockResolvedValue(0);
      (prisma.transportJob.create as jest.Mock<any>).mockResolvedValue({
        id: 'tj-1',
        jobNumber: 'TJ-000001',
        cargoWeight: 30,
        status: TransportJobStatus.AVAILABLE,
        pickupDate: new Date(),
        deliveryDate: new Date(),
        pickupCity: 'Riga',
        deliveryCity: 'Riga',
      });

      await service.createCallOff('fc-1', 'pos-1', callOffDto, 'user-buyer', 'company-buyer');

      expect(prisma.transportJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TransportJobStatus.AVAILABLE,
          }),
        }),
      );
    });
  });

  // ── formatContract — progressPct invariants ───────────────────────────────

  describe('formatContract (via findAll)', () => {
    it('sets progressPct to 0 when no call-offs exist', async () => {
      (prisma.frameworkContract.findMany as jest.Mock<any>).mockResolvedValue([
        stubContract({
          positions: [stubPosition({ callOffs: [] })],
        }),
      ]);

      const [result] = await service.findAll('user-buyer', 'company-buyer');
      expect(result.positions[0].progressPct).toBe(0);
    });

    it('caps progressPct at 100 even when call-offs exceed agreedQty', async () => {
      (prisma.frameworkContract.findMany as jest.Mock<any>).mockResolvedValue([
        stubContract({
          positions: [
            stubPosition({
              agreedQty: 100,
              callOffs: [
                { status: 'DELIVERED', cargoWeight: 120 }, // over-delivery
              ],
            }),
          ],
        }),
      ]);

      const [result] = await service.findAll('user-buyer', 'company-buyer');
      expect(result.positions[0].progressPct).toBe(100);
    });

    it('computes correct progressPct for partial consumption', async () => {
      (prisma.frameworkContract.findMany as jest.Mock<any>).mockResolvedValue([
        stubContract({
          positions: [
            stubPosition({
              agreedQty: 200,
              callOffs: [{ status: 'DELIVERED', cargoWeight: 50 }],
            }),
          ],
        }),
      ]);

      const [result] = await service.findAll('user-buyer', 'company-buyer');
      expect(result.positions[0].progressPct).toBe(25);
    });

    it('calculates totalProgressPct across all positions', async () => {
      (prisma.frameworkContract.findMany as jest.Mock<any>).mockResolvedValue([
        stubContract({
          positions: [
            stubPosition({ id: 'p1', agreedQty: 100, callOffs: [{ status: 'DELIVERED', cargoWeight: 50 }] }),
            stubPosition({ id: 'p2', agreedQty: 100, callOffs: [] }),
          ],
        }),
      ]);

      const [result] = await service.findAll('user-buyer', 'company-buyer');
      // total consumed 50 / total agreed 200 = 25 %
      expect(result.totalProgressPct).toBe(25);
    });
  });
});
