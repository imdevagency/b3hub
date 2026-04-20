import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route handler as public — the JwtAuthGuard will skip token
 * validation entirely and allow unauthenticated requests through.
 *
 * Usage:
 *   @Public()
 *   @Get('validate/:passNumber')
 *   validate(...) { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
