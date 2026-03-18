import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { RequestingUser } from '../../common/types/requesting-user.interface.js';

interface JwtPayload {
  sub: string;
  email?: string;
  userType: string;
  isCompany?: boolean;
  canSell?: boolean;
  canTransport?: boolean;
  companyId?: string;
  companyRole?: string;
  permCreateContracts?: boolean;
  permReleaseCallOffs?: boolean;
  permManageOrders?: boolean;
  permViewFinancials?: boolean;
  permManageTeam?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'your-secret-key',
    });
  }

  validate(payload: JwtPayload): RequestingUser {
    return {
      id: payload.sub,
      userId: payload.sub,
      email: payload.email,
      userType: payload.userType,
      isCompany: payload.isCompany ?? false,
      canSell: payload.canSell ?? false,
      canTransport: payload.canTransport ?? false,
      companyId: payload.companyId,
      companyRole: payload.companyRole,
      permCreateContracts: payload.permCreateContracts ?? false,
      permReleaseCallOffs: payload.permReleaseCallOffs ?? false,
      permManageOrders: payload.permManageOrders ?? false,
      permViewFinancials: payload.permViewFinancials ?? false,
      permManageTeam: payload.permManageTeam ?? false,
    };
  }
}
