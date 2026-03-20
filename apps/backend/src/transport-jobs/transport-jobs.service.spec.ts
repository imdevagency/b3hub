import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TransportJobStatus } from '@prisma/client';
import { TransportJobsService } from './transport-jobs.service';

describe('TransportJobsService', () => {
  const prisma = {
    transportJob: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    deliveryProof: {
      create: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    driverProfile: {
      updateMany: jest.fn(),
    },
    document: {
      findFirst: jest.fn(),
    },
  } as any;

  const notifications = {
    create: jest.fn(),
    createForMany: jest.fn(),
  } as any;

  const documents = {
    generateDeliveryNote: jest.fn(),
    generateWeighingSlip: jest.fn(),
  } as any;

  const service = new TransportJobsService(prisma, notifications, documents);

  beforeEach(() => {
    jest.clearAllMocks();
  });

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
});
