/**
 * JWT auth guard.
 * Protects routes that require a valid access token; throws 401 otherwise.
 * Apply with @UseGuards(JwtAuthGuard).
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
