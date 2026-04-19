import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckError,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // 1. Database
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prisma.$queryRaw`SELECT 1`;
          return { database: { status: 'up' } };
        } catch (err) {
          throw new HealthCheckError('Database unreachable', {
            database: { status: 'down', message: (err as Error).message },
          });
        }
      },
      // 2. Stripe — verify the secret key is present and well-formed
      (): Promise<HealthIndicatorResult> => {
        const key = process.env.STRIPE_SECRET_KEY ?? '';
        if (!key.startsWith('sk_')) {
          throw new HealthCheckError('Stripe not configured', {
            stripe: {
              status: 'down',
              message: 'STRIPE_SECRET_KEY missing or invalid',
            },
          });
        }
        return { stripe: { status: 'up' } };
      },
      // 3. Supabase — verify the project URL is set
      (): Promise<HealthIndicatorResult> => {
        const url = process.env.SUPABASE_URL ?? '';
        if (!url.startsWith('https://')) {
          throw new HealthCheckError('Supabase not configured', {
            supabase: {
              status: 'down',
              message: 'SUPABASE_URL missing or invalid',
            },
          });
        }
        return { supabase: { status: 'up' } };
      },
    ]);
  }
}
