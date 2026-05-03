import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const COMPANY_FEATURE_KEY = 'companyFeature';

/**
 * Decorator — marks a route as requiring a specific CompanyFeature flag.
 *
 * @example
 * @RequireCompanyFeature('CONSTRUCTION_MANAGEMENT')
 * @UseGuards(JwtAuthGuard, CompanyFeatureGuard)
 */
export const RequireCompanyFeature = (feature: string) =>
  SetMetadata(COMPANY_FEATURE_KEY, feature);

/**
 * Guard that allows access only when the authenticated user's company
 * has the specified feature flag enabled.
 *
 * Use after JwtAuthGuard so req.user is already populated.
 *
 * @example
 * @UseGuards(JwtAuthGuard, CompanyFeatureGuard)
 * @RequireCompanyFeature('CONSTRUCTION_MANAGEMENT')
 */
@Injectable()
export class CompanyFeatureGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFeature = this.reflector.getAllAndOverride<string>(
      COMPANY_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no feature is required, allow through
    if (!requiredFeature) return true;

    const req = context.switchToHttp().getRequest<any>();
    const user = req.user;

    // ADMINs can always access (they manage the platform)
    if (user?.userType === 'ADMIN') return true;

    const features: string[] = user?.companyFeatures ?? [];
    if (!features.includes(requiredFeature)) {
      throw new ForbiddenException(
        `This feature (${requiredFeature}) is not enabled for your account.`,
      );
    }

    return true;
  }
}
