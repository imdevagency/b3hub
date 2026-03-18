/**
 * @Roles(...roles) method/class decorator.
 * Attaches required UserType roles as metadata consumed by RolesGuard.
 */
import { SetMetadata } from '@nestjs/common';
import { UserType } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserType[]) => SetMetadata(ROLES_KEY, roles);
