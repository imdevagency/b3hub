/**
 * Augment Express's Request type so req.user is fully typed everywhere.
 * Mirrors RequestingUser (src/common/types/requesting-user.interface.ts).
 */
declare namespace Express {
  interface RequestingUserPayload {
    id: string;
    userId: string;
    email?: string;
    userType: string;
    isCompany: boolean;
    canSell: boolean;
    canTransport: boolean;
    companyId?: string;
    companyRole?: string;
    permCreateContracts: boolean;
    permReleaseCallOffs: boolean;
    permManageOrders: boolean;
    permViewFinancials: boolean;
    permManageTeam: boolean;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface User extends RequestingUserPayload {}
}
