/**
 * @CurrentUser() param decorator.
 * Extracts the authenticated RequestingUser from req.user into a controller param.
 * Only valid on routes protected by JwtAuthGuard.
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestingUser } from '../types/requesting-user.interface.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestingUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user as RequestingUser;
  },
);
