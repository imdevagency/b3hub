import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard that only allows ADMIN users through.
 * Use with @UseGuards(JwtAuthGuard, AdminGuard)
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<Express.Request>();
    if (user?.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
