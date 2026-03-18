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
  handleRequest(
    _err: unknown,
    user: RequestingUser | null,
  ): RequestingUser | undefined {
    return user ?? undefined;
  }
}
