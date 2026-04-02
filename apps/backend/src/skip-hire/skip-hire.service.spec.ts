/**
 * SkipHireService — Business Rule Tests
 *
 * Key rules documented here:
 *  - Price is always re-derived server-side from carrier pricing (never trusted from client)
 *  - getQuotes filters out unverified carriers, carriers outside service zone, and blocked dates
 *  - findOne gates non-admin access to the owning userId
 *  - cancel is blocked for COMPLETED or COLLECTED orders
 *  - getCarrierMapSkips requires canSkipHire flag and a companyId
 *  - updateCarrierStatus enforces the state machine: CONFIRMED→DELIVERED→COLLECTED only
 *  - Carrier can only update orders assigned to their own company
 */

import { beforeEach, describe, it, expect, jest } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SkipHireService } from './skip-hire.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SkipHireStatus, SkipSize } from '@prisma/client';

// ── Helpers ───────────────────────────────────────────────────────────────────

function stubOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'skip-1',
    orderNumber: 'SKP2601001',
    userId: 'user-1',
    carrierId: 'carrier-1',
    location: 'Riga',
    lat: null,
    lng: null,
    wasteCategory: 'MIXED',
    skipSize: SkipSize.MIDI,
    deliveryDate: new Date('2026-06-01'),
    price: 129,
    currency: 'EUR',
    status: SkipHireStatus.PENDING,
    ...overrides,
  };
}

// ── Fixture ───────────────────────────────────────────────────────────────────

describe('SkipHireService', () => {
  let service: SkipHireService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const mockPrisma = {
      skipHireOrder: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      carrierPricing: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const mockNotifications = {
      create: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        SkipHireService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(SkipHireService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;

    jest.clearAllMocks();
  });

  // ── create — server-side price derivation ────────────────────────────────

  describe('create — price derivation', () => {
    const baseDto = {
      location: 'Riga',
      wasteCategory: 'MIXED' as const,
      skipSize: SkipSize.MIDI,
      deliveryDate: '2026-06-01',
      contactName: 'Jānis',
      contactEmail: 'janis@test.lv',
      contactPhone: '+37120000001',
    };

    it('throws BadRequestException when selected carrier has no pricing for the skip size', async () => {
      (prisma.carrierPricing.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create({ ...baseDto, carrierId: 'carrier-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('uses platform default MIDI price (129) when no carrier is selected', async () => {
      (prisma.skipHireOrder.count as jest.Mock).mockResolvedValue(0);
      (prisma.skipHireOrder.create as jest.Mock).mockResolvedValue(stubOrder());

      await service.create(baseDto);

      expect(prisma.skipHireOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ price: 129 }),
        }),
      );
    });

    it('applies carrier price + zone surcharge server-side', async () => {
      (prisma.carrierPricing.findUnique as jest.Mock).mockResolvedValue({
        price: 110,
        skipSize: SkipSize.MIDI,
        carrier: {
          serviceZones: [{ city: 'Riga', postcode: null, surcharge: 15 }],
        },
      });
      (prisma.skipHireOrder.count as jest.Mock).mockResolvedValue(0);
      (prisma.skipHireOrder.create as jest.Mock).mockResolvedValue(
        stubOrder({ price: 125 }),
      );

      await service.create({ ...baseDto, carrierId: 'carrier-1' });

      expect(prisma.skipHireOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ price: 125 }),
        }),
      );
    });
  });

  // ── getQuotes — carrier filtering ────────────────────────────────────────

  describe('getQuotes', () => {
    it('returns empty array when no carrier pricing exists', async () => {
      (prisma.carrierPricing.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.getQuotes(SkipSize.MIDI, 'Riga', '2026-06-01');
      expect(result).toEqual([]);
    });

    it('filters out unverified carriers', async () => {
      (prisma.carrierPricing.findMany as jest.Mock).mockResolvedValue([
        {
          price: 129,
          currency: 'EUR',
          carrier: {
            id: 'c1',
            name: 'BadCarrier',
            logo: null,
            rating: null,
            companyType: 'CARRIER',
            verified: false,
            serviceZones: [{ city: 'Riga', postcode: null, surcharge: 0 }],
            availabilityBlocks: [],
          },
        },
      ]);

      const result = await service.getQuotes(SkipSize.MIDI, 'Riga', '2026-06-01');
      expect(result).toHaveLength(0);
    });

    it('filters out carriers with no matching service zone', async () => {
      (prisma.carrierPricing.findMany as jest.Mock).mockResolvedValue([
        {
          price: 129,
          currency: 'EUR',
          carrier: {
            id: 'c1',
            name: 'CarrierJēkabpils',
            logo: null,
            rating: 4.5,
            companyType: 'CARRIER',
            verified: true,
            serviceZones: [{ city: 'Jēkabpils', postcode: null, surcharge: 0 }],
            availabilityBlocks: [],
          },
        },
      ]);

      const result = await service.getQuotes(SkipSize.MIDI, 'Riga', '2026-06-01');
      expect(result).toHaveLength(0);
    });

    it('filters out carriers blocked on the requested date', async () => {
      (prisma.carrierPricing.findMany as jest.Mock).mockResolvedValue([
        {
          price: 129,
          currency: 'EUR',
          carrier: {
            id: 'c1',
            name: 'BlockedCarrier',
            logo: null,
            rating: 4.0,
            companyType: 'CARRIER',
            verified: true,
            serviceZones: [{ city: 'Riga', postcode: null, surcharge: 0 }],
            availabilityBlocks: [{ blockedDate: new Date('2026-06-01') }],
          },
        },
      ]);

      const result = await service.getQuotes(SkipSize.MIDI, 'Riga', '2026-06-01');
      expect(result).toHaveLength(0);
    });

    it('returns and sorts verified available carriers by price ascending', async () => {
      (prisma.carrierPricing.findMany as jest.Mock).mockResolvedValue([
        {
          price: 149,
          currency: 'EUR',
          carrier: {
            id: 'c2',
            name: 'ExpensiveCarrier',
            logo: null,
            rating: 5.0,
            companyType: 'CARRIER',
            verified: true,
            serviceZones: [{ city: 'Riga', postcode: null, surcharge: 0 }],
            availabilityBlocks: [],
          },
        },
        {
          price: 119,
          currency: 'EUR',
          carrier: {
            id: 'c1',
            name: 'CheapCarrier',
            logo: null,
            rating: 4.0,
            companyType: 'CARRIER',
            verified: true,
            serviceZones: [{ city: 'Riga', postcode: null, surcharge: 0 }],
            availabilityBlocks: [],
          },
        },
      ]);

      const result = await service.getQuotes(SkipSize.MIDI, 'Riga', '2026-06-01');
      expect(result).toHaveLength(2);
      expect(result[0].price).toBe(119);
      expect(result[1].price).toBe(149);
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when order does not exist', async () => {
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when non-admin accesses another user\'s order', async () => {
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ userId: 'owner-user' }),
      );
      await expect(
        service.findOne('skip-1', 'other-user', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to access any order', async () => {
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ userId: 'owner-user' }),
      );
      await expect(
        service.findOne('skip-1', 'admin-user', true),
      ).resolves.toBeDefined();
    });

    it('allows the order owner to access their own order', async () => {
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ userId: 'user-1' }),
      );
      await expect(
        service.findOne('skip-1', 'user-1', false),
      ).resolves.toBeDefined();
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('throws BadRequestException when cancelling a COMPLETED order', async () => {
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ status: SkipHireStatus.COMPLETED, userId: 'user-1' }),
      );
      await expect(
        service.cancel('skip-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when cancelling a COLLECTED order', async () => {
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ status: SkipHireStatus.COLLECTED, userId: 'user-1' }),
      );
      await expect(
        service.cancel('skip-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows cancellation of PENDING orders', async () => {
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ status: SkipHireStatus.PENDING, userId: 'user-1' }),
      );
      (prisma.skipHireOrder.update as jest.Mock).mockResolvedValue(
        stubOrder({ status: SkipHireStatus.CANCELLED }),
      );

      const result = await service.cancel('skip-1', 'user-1');
      expect(result.status).toBe(SkipHireStatus.CANCELLED);
    });

    it('allows cancellation of CONFIRMED orders', async () => {
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ status: SkipHireStatus.CONFIRMED, userId: 'user-1' }),
      );
      (prisma.skipHireOrder.update as jest.Mock).mockResolvedValue(
        stubOrder({ status: SkipHireStatus.CANCELLED }),
      );

      await expect(
        service.cancel('skip-1', 'user-1'),
      ).resolves.toBeDefined();
    });
  });

  // ── getCarrierMapSkips ────────────────────────────────────────────────────

  describe('getCarrierMapSkips', () => {
    it('throws ForbiddenException when user does not have canSkipHire flag', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        companyId: 'carrier-1',
        canSkipHire: false,
      });
      await expect(service.getCarrierMapSkips('driver-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when user has no companyId', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        companyId: null,
        canSkipHire: true,
      });
      await expect(service.getCarrierMapSkips('driver-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns only CONFIRMED and DELIVERED orders for the carrier', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        companyId: 'carrier-1',
        canSkipHire: true,
      });
      (prisma.skipHireOrder.findMany as jest.Mock).mockResolvedValue([
        stubOrder({ status: SkipHireStatus.CONFIRMED, carrierId: 'carrier-1' }),
        stubOrder({ status: SkipHireStatus.DELIVERED, carrierId: 'carrier-1' }),
      ]);

      const result = await service.getCarrierMapSkips('driver-1');
      expect(result).toHaveLength(2);
    });
  });

  // ── updateCarrierStatus — state machine ──────────────────────────────────

  describe('updateCarrierStatus', () => {
    it('throws ForbiddenException when user lacks canSkipHire', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        companyId: 'carrier-1',
        canSkipHire: false,
      });
      await expect(
        service.updateCarrierStatus('skip-1', SkipHireStatus.DELIVERED, 'driver-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when order belongs to a different carrier', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        companyId: 'carrier-1',
        canSkipHire: true,
      });
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ carrierId: 'other-carrier', status: SkipHireStatus.CONFIRMED }),
      );
      await expect(
        service.updateCarrierStatus('skip-1', SkipHireStatus.DELIVERED, 'driver-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for an invalid state transition', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        companyId: 'carrier-1',
        canSkipHire: true,
      });
      // PENDING → COLLECTED is not in the allowed map
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ carrierId: 'carrier-1', status: SkipHireStatus.PENDING }),
      );
      await expect(
        service.updateCarrierStatus('skip-1', SkipHireStatus.COLLECTED, 'driver-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when target status does not match the expected next step', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        companyId: 'carrier-1',
        canSkipHire: true,
      });
      // CONFIRMED → next should be DELIVERED, not COLLECTED
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ carrierId: 'carrier-1', status: SkipHireStatus.CONFIRMED }),
      );
      await expect(
        service.updateCarrierStatus('skip-1', SkipHireStatus.COLLECTED, 'driver-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows CONFIRMED → DELIVERED transition', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        companyId: 'carrier-1',
        canSkipHire: true,
      });
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ carrierId: 'carrier-1', status: SkipHireStatus.CONFIRMED, userId: 'user-1' }),
      );
      (prisma.skipHireOrder.update as jest.Mock).mockResolvedValue(
        stubOrder({ status: SkipHireStatus.DELIVERED }),
      );

      const result = await service.updateCarrierStatus(
        'skip-1',
        SkipHireStatus.DELIVERED,
        'driver-1',
      );
      expect(result.status).toBe(SkipHireStatus.DELIVERED);
    });

    it('allows DELIVERED → COLLECTED transition', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        companyId: 'carrier-1',
        canSkipHire: true,
      });
      (prisma.skipHireOrder.findUnique as jest.Mock).mockResolvedValue(
        stubOrder({ carrierId: 'carrier-1', status: SkipHireStatus.DELIVERED, userId: 'user-1' }),
      );
      (prisma.skipHireOrder.update as jest.Mock).mockResolvedValue(
        stubOrder({ status: SkipHireStatus.COLLECTED }),
      );

      const result = await service.updateCarrierStatus(
        'skip-1',
        SkipHireStatus.COLLECTED,
        'driver-1',
      );
      expect(result.status).toBe(SkipHireStatus.COLLECTED);
    });
  });
});
