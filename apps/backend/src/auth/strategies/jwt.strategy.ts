/**
 * Passport JWT strategy.
 * Extracts the Bearer token from Authorization header, verifies against
 * JWT_SECRET, and maps the payload to a RequestingUser placed on req.user.
 * Also validates tokenVersion against the DB to reject stale tokens issued
 * before a capability or role change.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { RequestingUser } from '../../common/types/requesting-user.interface.js';

interface JwtPayload {
  sub: string;
  email?: string;
  userType: string;
  isCompany?: boolean;
  canSell?: boolean;
  canTransport?: boolean;
  canSkipHire?: boolean;
  companyId?: string;
  companyRole?: string;
  permCreateContracts?: boolean;
  permReleaseCallOffs?: boolean;
  permManageOrders?: boolean;
  permViewFinancials?: boolean;
  permManageTeam?: boolean;
  payoutEnabled?: boolean;
  tokenVersion?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? (() => { throw new Error('JWT_SECRET environment variable is required'); })(),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestingUser> {
    // Reject tokens whose tokenVersion is behind the DB value.
    // This invalidates JWTs mid-session when capabilities or roles change.
    const tokenVer = payload.tokenVersion ?? 0;
    const dbUser = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true },
    });
    if (!dbUser || dbUser.tokenVersion > tokenVer) {
      throw new UnauthorizedException('Token has been invalidated. Please log in again.');
    }

    return {
      id: payload.sub,
      userId: payload.sub,
      email: payload.email,
      userType: payload.userType,
      isCompany: payload.isCompany ?? false,
      canSell: payload.canSell ?? false,
      canTransport: payload.canTransport ?? false,
      canSkipHire: payload.canSkipHire ?? false,
      companyId: payload.companyId,
      companyRole: payload.companyRole,
      permCreateContracts: payload.permCreateContracts ?? false,
      permReleaseCallOffs: payload.permReleaseCallOffs ?? false,
      permManageOrders: payload.permManageOrders ?? false,
      permViewFinancials: payload.permViewFinancials ?? false,
      permManageTeam: payload.permManageTeam ?? false,
      payoutEnabled: payload.payoutEnabled ?? false,
      tokenVersion: tokenVer,
    };
  }
}
