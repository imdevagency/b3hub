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
    const req = context.switchToHttp().getRequest<any>();
    const user = req.user;
    if (user?.userType !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}
