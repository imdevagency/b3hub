/**
 * ApiKeyGuard — allows machine-to-machine access using long-lived API keys.
 *
 * Accepts:  Authorization: Bearer b3_live_<40hex>
 * Falls through to the normal JwtAuthGuard if the token doesn't start with "b3_live_".
 *
 * On success, injects a synthetic RequestingUser onto req.user with:
 *   - companyId set to the key's company
 *   - apiScopes[] attached for downstream scope checking
 *   - minimal capability flags (all false — ERP reads data, doesn't impersonate users)
 *
 * Usage: replace @UseGuards(JwtAuthGuard) with @UseGuards(JwtOrApiKeyGuard)
 * on endpoints that should be accessible to API keys.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeysService } from '../../api-keys/api-keys.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { RequestingUser } from '../../common/types/requesting-user.interface';

declare module 'express' {
  interface Request {
    apiScopes?: string[];
  }
}

@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly jwtGuard: JwtAuthGuard,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    // Route to API key validation
    if (token.startsWith('b3_live_')) {
      const result = await this.apiKeysService.validateKey(token);
      if (!result)
        throw new UnauthorizedException('Invalid or expired API key');

      // Synthesize a RequestingUser — ERP context, no personal user ID
      const synthetic: RequestingUser & { apiScopes: string[] } = {
        id: `apikey:${result.keyId}`,
        userId: `apikey:${result.keyId}`,
        userType: 'BUYER',
        isCompany: true,
        canSell: false,
        canTransport: false,
        canSkipHire: false,
        companyId: result.companyId,
        companyRole: 'MEMBER',
        permCreateContracts: false,
        permReleaseCallOffs: false,
        permManageOrders: false,
        permViewFinancials: true, // API keys may read financial data (invoices)
        permManageTeam: false,
        payoutEnabled: false,
        apiScopes: result.scopes,
      };

      // Attach to request (Passport-compatible)
      (req as Request & { user: unknown }).user = synthetic;
      req.apiScopes = result.scopes;
      return true;
    }

    // Fall through to standard JWT validation
    return this.jwtGuard.canActivate(ctx) as Promise<boolean>;
  }
}
