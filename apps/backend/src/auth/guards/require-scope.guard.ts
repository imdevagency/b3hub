/**
 * @RequireScope('orders:read') — guard that checks req.apiScopes when the
 * caller authenticated via an API key. JWT users always pass (no scope check).
 *
 * Usage: add AFTER @UseGuards(JwtOrApiKeyGuard)
 *   @UseGuards(JwtOrApiKeyGuard, RequireScopeGuard)
 *   @RequireScope('orders:read')
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export const SCOPE_KEY = 'required_scope';
export const RequireScope = (scope: string) => SetMetadata(SCOPE_KEY, scope);

@Injectable()
export class RequireScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredScope = this.reflector.get<string>(SCOPE_KEY, ctx.getHandler());
    if (!requiredScope) return true; // no scope required

    const req = ctx.switchToHttp().getRequest<Request & { apiScopes?: string[] }>();
    if (!req.apiScopes) return true; // JWT user — skip scope check

    if (!req.apiScopes.includes(requiredScope)) {
      throw new ForbiddenException(
        `API key missing required scope: ${requiredScope}`,
      );
    }
    return true;
  }
}
