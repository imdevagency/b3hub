/** Represents the authenticated user extracted from the JWT (set by JwtStrategy). */
export interface RequestingUser {
  userId: string;
  userType: string; // 'BUYER' | 'ADMIN'
  isCompany: boolean;
  canSell: boolean;      // approved seller — can list materials, see incoming orders
  canTransport: boolean; // approved driver — can accept & execute transport jobs
  companyId?: string;    // linked Company id, if any
}
