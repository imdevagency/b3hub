import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TransportJobStatus } from '@prisma/client';
import { TransportJobsService } from './transport-jobs.service';
import type { RequestingUser } from '../common/types/requesting-user.interface';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDriver(overrides: Partial<RequestingUser> = {}): RequestingUser {
  return {
    id: 'driver-1',
    userId: 'driver-1',
    userType: 'BUYER',
    isCompany: false,
    canSell: false,
    canTransport: true,
    canSkipHire: false,
    permCreateContracts: false,
    permReleaseCallOffs: false,
    permManageOrders: false,
    permViewFinancials: false,
    permManageTeam: false,
    ...overrides,
  } as RequestingUser;
}

function makeDispatcher(overrides: Partial<RequestingUser> = {}): RequestingUser {
  return makeDriver({
    id: 'dispatcher-1',
    userId: 'dispatcher-1',
    isCompany: true,
    companyRole: 'OWNER',
    ...overrides,
  });
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe('TransportJobsService', () => {
  const prisma = {
    transportJob: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    deliveryProof: {
      create: jest.fn(),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    orderItem: {
      count: jest.fn().mockResolvedValue(0),
    },
    driverProfile: {
      updateMany: jest.fn(),
    },
    document: {
      findFirst: jest.fn(),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    vehicle: {
      findUnique: jest.fn(),
    },
    invoice: {
      update: jest.fn(),
    },
    transportJobException: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  } as any;

  const notifications = {
    create: jest.fn().mockResolvedValue(undefined),
    createForMany: jest.fn().mockResolvedValue(undefined),
  } as any;

  const documents = {
    generateDeliveryNote: jest.fn().mockResolvedValue(undefined),
    generateWeighingSlip: jest.fn().mockResolvedValue(undefined),
  } as any;

  const updates = {
    broadcastJobStatus: jest.fn(),
    broadcastJobLocation: jest.fn(),
  } as any;

  const email = {
    sendDriverJobAssigned: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new TransportJobsService(prisma, notifications, documents, updates, email);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.transportJob.findMany.mockResolvedValue([]);
    prisma.transportJob.count.mockResolvedValue(0);
    notifications.create.mockResolvedValue(undefined);
    notifications.createForMany.mockResolvedValue(undefined);
    documents.generateDeliveryNote.mockResolvedValue(undefined);
    documents.generateWeighingSlip.mockResolvedValue(undefined);
    updates.broadcastJobStatus.mockImplementation(() => {});
  });

  // ── Existing tests — kept intact ─────────────────────────────────────────

  it('blocks delivery proof submission when required non-proof documents are missing', async () => {
    prisma.transportJob.findUnique.mockResolvedValue({
      id: 'job1',
      driverId: 'driver1',
      status: TransportJobStatus.AT_DELIVERY,
      orderId: null,
    });
    jest.spyOn(service, 'getDocumentReadiness').mockResolvedValue({
      transportJobId: 'job1',
      status: TransportJobStatus.AT_DELIVERY,
      requires: { deliveryProof: true, weighingSlip: true },
      has: { deliveryProof: false, weighingSlip: false, deliveryNote: false },
      canMarkDelivered: false,
      missing: ['DELIVERY_PROOF', 'WEIGHING_SLIP'],
    });

    await expect(
      service.submitDeliveryProof('job1', 'driver1', {
        recipientName: 'Site lead',
        notes: 'Delivered',
        photos: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.deliveryProof.create).not.toHaveBeenCalled();
    expect(prisma.transportJob.update).not.toHaveBeenCalled();
  });

  it('blocks status update to DELIVERED when readiness gate fails', async () => {
    prisma.transportJob.findUnique.mockResolvedValue({
      id: 'job1',
      driverId: 'driver1',
      status: TransportJobStatus.AT_DELIVERY,
    });
    jest.spyOn(service, 'getDocumentReadiness').mockResolvedValue({
      transportJobId: 'job1',
      status: TransportJobStatus.AT_DELIVERY,
      requires: { deliveryProof: true, weighingSlip: true },
      has: { deliveryProof: false, weighingSlip: true, deliveryNote: false },
      canMarkDelivered: false,
      missing: ['DELIVERY_PROOF'],
    });

    await expect(
      service.updateStatus('job1', 'driver1', {
        status: TransportJobStatus.DELIVERED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.transportJob.update).not.toHaveBeenCalled();
  });

  it('blocks status updates from non-assigned driver', async () => {
    prisma.transportJob.findUnique.mockResolvedValue({
      id: 'job1',
      driverId: 'driver2',
      status: TransportJobStatus.ACCEPTED,
    });

    await expect(
      service.updateStatus('job1', 'driver1', {
        status: TransportJobStatus.EN_ROUTE_PICKUP,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.transportJob.update).not.toHaveBeenCalled();
  });

  // ── accept — job acceptance guards ───────────────────────────────────────

  describe('accept', () => {
    it('throws NotFoundException when job does not exist', async () => {
      prisma.transportJob.findUnique.mockResolvedValue(null);
      await expect(service.accept('missing', 'driver-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when job is not AVAILABLE', async () => {
      prisma.transportJob.findUnique.mockResolvedValue({
        id: 'job1',
        status: TransportJobStatus.ACCEPTED,
      });
      await expect(service.accept('job1', 'driver-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when driver already has an active job', async () => {
      prisma.transportJob.findUnique.mockResolvedValue({
        id: 'job1',
        status: TransportJobStatus.AVAILABLE,
      });
      // findFirst is used by findMyActiveJob internally via findMany
      prisma.transportJob.findFirst.mockResolvedValue({
        id: 'existing-job',
        driverId: 'driver-1',
        status: TransportJobStatus.EN_ROUTE_PICKUP,
      });

      await expect(service.accept('job1', 'driver-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows a driver with no active job to accept an AVAILABLE job', async () => {
      prisma.transportJob.findUnique.mockResolvedValueOnce({
        id: 'job1',
        status: TransportJobStatus.AVAILABLE,
        jobNumber: 'TRJ2601001',
        pickupCity: 'Riga',
        deliveryCity: 'Jūrmala',
        order: null,
      });
      // findFirst for active-job check returns null
      prisma.transportJob.findFirst.mockResolvedValue(null);
      prisma.transportJob.update.mockResolvedValue({
        id: 'job1',
        status: TransportJobStatus.ACCEPTED,
        jobNumber: 'TRJ2601001',
        pickupCity: 'Riga',
        deliveryCity: 'Jūrmala',
        order: { buyerId: null },
        driver: null,
        vehicle: null,
        pickupDate: new Date(),
        deliveryDate: new Date(),
      });

      await expect(service.accept('job1', 'driver-1')).resolves.toBeDefined();
      expect(prisma.transportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TransportJobStatus.ACCEPTED,
            driverId: 'driver-1',
          }),
        }),
      );
    });
  });

  // ── updateStatus — state machine transitions ─────────────────────────────

  describe('updateStatus — state machine', () => {
    const validTransitions: Array<[TransportJobStatus, TransportJobStatus]> = [
      [TransportJobStatus.ACCEPTED, TransportJobStatus.EN_ROUTE_PICKUP],
      [TransportJobStatus.EN_ROUTE_PICKUP, TransportJobStatus.AT_PICKUP],
      [TransportJobStatus.AT_PICKUP, TransportJobStatus.LOADED],
      [TransportJobStatus.LOADED, TransportJobStatus.EN_ROUTE_DELIVERY],
      [TransportJobStatus.EN_ROUTE_DELIVERY, TransportJobStatus.AT_DELIVERY],
    ];

    validTransitions.forEach(([from, to]) => {
      it(`allows ${from} → ${to}`, async () => {
        prisma.transportJob.findUnique.mockResolvedValue({
          id: 'job1',
          driverId: 'driver-1',
          status: from,
          orderId: null,
          jobType: 'MATERIAL_DELIVERY',
        });
        prisma.transportJob.update.mockResolvedValue({
          id: 'job1',
          status: to,
          jobNumber: 'TRJ-1',
          pickupCity: 'Riga',
          deliveryCity: 'Jūrmala',
          order: null,
          driver: null,
          vehicle: null,
          pickupDate: new Date(),
          deliveryDate: new Date(),
        });

        const dto: any = { status: to };
        if (to === TransportJobStatus.LOADED) dto.weightKg = 5000;

        await expect(
          service.updateStatus('job1', 'driver-1', dto),
        ).resolves.toBeDefined();
      });
    });

    it('blocks AT_PICKUP → DELIVERED (skipping LOADED and EN_ROUTE_DELIVERY)', async () => {
      prisma.transportJob.findUnique.mockResolvedValue({
        id: 'job1',
        driverId: 'driver-1',
        status: TransportJobStatus.AT_PICKUP,
      });

      await expect(
        service.updateStatus('job1', 'driver-1', {
          status: TransportJobStatus.DELIVERED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks LOADED transition when weightKg is missing', async () => {
      prisma.transportJob.findUnique.mockResolvedValue({
        id: 'job1',
        driverId: 'driver-1',
        status: TransportJobStatus.AT_PICKUP,
      });

      await expect(
        service.updateStatus('job1', 'driver-1', {
          status: TransportJobStatus.LOADED,
          // no weightKg
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getSlaState — overdue calculation ────────────────────────────────────

  describe('getSlaState (via private method — tested through mapWithSla behaviour)', () => {
    it('is null for DELIVERED jobs regardless of date', () => {
      // Access the private method via bracket notation for unit testing
      const sla = (service as any).getSlaState({
        status: TransportJobStatus.DELIVERED,
        pickupDate: new Date('2020-01-01'),
        deliveryDate: new Date('2020-01-01'),
      });
      expect(sla.stage).toBeNull();
      expect(sla.overdueMinutes).toBe(0);
    });

    it('is null for CANCELLED jobs', () => {
      const sla = (service as any).getSlaState({
        status: TransportJobStatus.CANCELLED,
        pickupDate: new Date('2020-01-01'),
        deliveryDate: new Date('2020-01-01'),
      });
      expect(sla.stage).toBeNull();
    });

    it('returns PICKUP_DELAY for pre-LOADED job past pickup deadline', () => {
      const past = new Date(Date.now() - 2 * 60 * 60_000); // 2h ago
      const sla = (service as any).getSlaState({
        status: TransportJobStatus.ACCEPTED,
        pickupDate: past,
        deliveryDate: new Date(Date.now() + 60_000),
      });
      expect(sla.stage).toBe('PICKUP_DELAY');
      expect(sla.overdueMinutes).toBeGreaterThan(0);
    });

    it('returns DELIVERY_DELAY for post-LOADED job past delivery deadline', () => {
      const past = new Date(Date.now() - 2 * 60 * 60_000);
      const sla = (service as any).getSlaState({
        status: TransportJobStatus.EN_ROUTE_DELIVERY,
        pickupDate: past,
        deliveryDate: past, // delivery also in the past
      });
      expect(sla.stage).toBe('DELIVERY_DELAY');
    });

    it('returns null stage when well within SLA window', () => {
      const future = new Date(Date.now() + 60 * 60_000); // 1h from now
      const sla = (service as any).getSlaState({
        status: TransportJobStatus.ACCEPTED,
        pickupDate: future,
        deliveryDate: new Date(Date.now() + 2 * 60 * 60_000),
      });
      expect(sla.stage).toBeNull();
      expect(sla.overdueMinutes).toBe(0);
    });
  });

  // ── createAsUser — dispatcher guard ─────────────────────────────────────

  describe('createAsUser', () => {
    it('blocks a plain driver (no company role) from creating jobs', async () => {
      const plainDriver = makeDriver({ isCompany: false, companyRole: undefined });

      await expect(
        service.createAsUser(
          {
            jobType: 'MATERIAL_DELIVERY',
            pickupAddress: 'A',
            pickupCity: 'Riga',
            pickupDate: '2026-06-01',
            deliveryAddress: 'B',
            deliveryCity: 'Jūrmala',
            deliveryDate: '2026-06-01',
            cargoType: 'Gravel',
          } as any,
          plainDriver,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an OWNER to create jobs', async () => {
      const owner = makeDispatcher();
      prisma.transportJob.count.mockResolvedValue(0);
      prisma.transportJob.create.mockResolvedValue({
        id: 'job1',
        jobNumber: 'TRJ2601001',
        status: TransportJobStatus.AVAILABLE,
        pickupDate: new Date(),
        deliveryDate: new Date(),
        driver: null,
        vehicle: null,
        order: null,
      });

      await expect(
        service.createAsUser(
          {
            jobType: 'MATERIAL_DELIVERY',
            pickupAddress: 'A',
            pickupCity: 'Riga',
            pickupDate: '2026-06-01',
            deliveryAddress: 'B',
            deliveryCity: 'Jūrmala',
            deliveryDate: '2026-06-01',
            cargoType: 'Gravel',
          } as any,
          owner,
        ),
      ).resolves.toBeDefined();
    });
  });

  // ── assign / reassign ────────────────────────────────────────────────────

  describe('assign', () => {
    it('throws BadRequestException when job is not AVAILABLE', async () => {
      prisma.transportJob.findUnique.mockResolvedValue({
        id: 'job1',
        status: TransportJobStatus.ACCEPTED,
      });

      await expect(
        service.assign('job1', { driverId: 'driver-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reassign', () => {
    it('throws BadRequestException when job is not ACCEPTED', async () => {
      prisma.transportJob.findUnique.mockResolvedValue({
        id: 'job1',
        status: TransportJobStatus.AVAILABLE,
      });

      await expect(
        service.reassign('job1', { driverId: 'driver-2' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when attempting to reassign an in-progress job', async () => {
      prisma.transportJob.findUnique.mockResolvedValue({
        id: 'job1',
        status: TransportJobStatus.LOADED,
      });

      await expect(
        service.reassign('job1', { driverId: 'driver-2' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── findReturnTrips — Haversine distance filter ──────────────────────────

  describe('findReturnTrips', () => {
    it('returns only jobs within the requested radius', async () => {
      prisma.transportJob.findMany.mockResolvedValue([
        {
          id: 'j1',
          status: TransportJobStatus.AVAILABLE,
          pickupLat: 56.946,
          pickupLng: 24.105,
          pickupDate: new Date(),
          deliveryDate: new Date(),
          driver: null,
          vehicle: null,
          order: null,
        },
        // Far away — Tallinn is ~310 km from Riga
        {
          id: 'j2',
          status: TransportJobStatus.AVAILABLE,
          pickupLat: 59.437,
          pickupLng: 24.753,
          pickupDate: new Date(),
          deliveryDate: new Date(),
          driver: null,
          vehicle: null,
          order: null,
        },
      ]);

      // Searching from Riga centre (56.946, 24.105) within 50 km
      const result = await service.findReturnTrips(56.946, 24.105, 50);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('j1');
      expect(result[0].returnDistanceKm).toBe(0);
    });

    it('returns empty array when no jobs are available nearby', async () => {
      prisma.transportJob.findMany.mockResolvedValue([]);
      const result = await service.findReturnTrips(56.946, 24.105, 50);
      expect(result).toEqual([]);
    });

    it('excludes jobs with null coordinates', async () => {
      prisma.transportJob.findMany.mockResolvedValue([
        {
          id: 'j1',
          status: TransportJobStatus.AVAILABLE,
          pickupLat: null,
          pickupLng: null,
          pickupDate: new Date(),
          deliveryDate: new Date(),
          driver: null,
          vehicle: null,
          order: null,
        },
      ]);

      const result = await service.findReturnTrips(56.946, 24.105, 200);
      expect(result).toHaveLength(0);
    });
  });
});
