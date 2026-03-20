/**
 * Optional JWT auth guard.
 * Like JwtAuthGuard but never throws — public routes that can optionally
 * identify the caller use this. req.user is undefined when no valid token.
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { RequestingUser } from '../../common/types/requesting-user.interface.js';

/**
 * Like JwtAuthGuard but never throws — if no token or invalid token is
 * present the request continues with `req.user = undefined`.
 * Use on endpoints that are public but can optionally identify the caller.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest(_err: any, user: any, ..._rest: any[]): any {
    return (user as RequestingUser | null) ?? undefined;
  }
}
