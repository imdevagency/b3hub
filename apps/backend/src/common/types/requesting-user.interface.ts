/** Represents the authenticated user extracted from the JWT (populated by JwtStrategy.validate). */
export interface RequestingUser {
  /** Primary ID (alias: same as userId) */
  id: string;
  userId: string;
  email?: string;
  userType: string; // 'BUYER' | 'SUPPLIER' | 'CARRIER' | 'ADMIN'
  isCompany: boolean;
  canSell: boolean;    // approved seller — can list materials, see incoming orders
  canTransport: boolean; // approved driver — can accept & execute transport jobs
  companyId?: string;    // linked Company id, if any
  companyRole?: string;  // 'OWNER' | 'MANAGER' | 'DRIVER' | 'MEMBER'
  // Fine-grained company member permissions
  permCreateContracts: boolean;
  permReleaseCallOffs: boolean;
  permManageOrders: boolean;
  permViewFinancials: boolean;
  permManageTeam: boolean;
}
