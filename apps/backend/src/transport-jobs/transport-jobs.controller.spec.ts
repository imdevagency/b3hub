import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { TransportJobsController } from './transport-jobs.controller';
import { TransportJobsService } from './transport-jobs.service';
import type { RequestingUser } from '../common/types/requesting-user.interface';

function makeUser(overrides: Partial<RequestingUser> = {}): RequestingUser {
  return {
    id: 'u1',
    userId: 'u1',
    email: 'user@example.com',
    userType: 'BUYER',
    isCompany: true,
    canSell: false,
    canTransport: true,
    canSkipHire: false,
    companyId: 'c1',
    companyRole: 'MEMBER',
    permCreateContracts: false,
    permReleaseCallOffs: false,
    permManageOrders: false,
    permViewFinancials: false,
    permManageTeam: false,
    ...overrides,
  };
}

describe('TransportJobsController', () => {
  const service = {
    findSlaOverdue: jest.fn(),
    findOpenExceptions: jest.fn(),
    resolveException: jest.fn(),
  } as unknown as TransportJobsService;

  const controller = new TransportJobsController(service);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks non-dispatch user from SLA overdue queue', () => {
    const user = makeUser();

    expect(() => controller.findSlaOverdue(user)).toThrow(ForbiddenException);
    expect((service as any).findSlaOverdue).not.toHaveBeenCalled();
  });

  it('allows dispatch-capable user to fetch SLA overdue queue', async () => {
    const user = makeUser({ companyRole: 'MANAGER' });
    (service as any).findSlaOverdue.mockResolvedValue([{ id: 'job1' }]);

    const result = await controller.findSlaOverdue(user);

    expect((service as any).findSlaOverdue).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ id: 'job1' }]);
  });

  it('blocks non-dispatch user from resolving exceptions', () => {
    const user = makeUser({ companyRole: 'DRIVER' });

    expect(() =>
      controller.resolveException('job1', 'ex1', user, { resolution: 'Handled' }),
    ).toThrow(ForbiddenException);

    expect((service as any).resolveException).not.toHaveBeenCalled();
  });

  it('allows dispatcher to resolve exception', async () => {
    const user = makeUser({ permManageOrders: true });
    (service as any).resolveException.mockResolvedValue({ id: 'ex1', status: 'RESOLVED' });

    const result = await controller.resolveException('job1', 'ex1', user, {
      resolution: 'Issue resolved by dispatch',
    });

    expect((service as any).resolveException).toHaveBeenCalledWith(
      'job1',
      'ex1',
      'u1',
      { resolution: 'Issue resolved by dispatch' },
    );
    expect(result).toEqual({ id: 'ex1', status: 'RESOLVED' });
  });
});
