import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Like JwtAuthGuard but never throws — if no token or invalid token is
 * present the request continues with `req.user = undefined`.
 * Use on endpoints that are public but can optionally identify the caller.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleRequest(_err: any, user: any) {
    return user || undefined;
  }
}
