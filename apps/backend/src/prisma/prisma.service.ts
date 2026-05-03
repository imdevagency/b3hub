/**
 * Prisma database client service.
 * Extends PrismaClient, opens the connection on module init and closes on destroy.
 * Uses the PrismaPg driver adapter for direct PostgreSQL access.
 */
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  [x: string]: any;
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    await this.releaseStaleAdvisoryLocks();
  }

  /**
   * On startup, terminate any Postgres backends (other than ours) that hold
   * session-level advisory locks. These are stale connections from a previous
   * NestJS process that pgBouncer kept alive — they prevent cron jobs from
   * acquiring the transaction-level advisory lock until the connection is killed.
   *
   * Safe for single-instance deployments. In a multi-instance setup, advisory
   * lock contention is intentional, so this should be disabled if scaling
   * horizontally with multiple persistent workers.
   */
  private async releaseStaleAdvisoryLocks(): Promise<void> {
    try {
      const rows = await (this as any).$queryRaw<{ pid: number; terminated: boolean }[]>`
        SELECT pid, pg_terminate_backend(pid) AS terminated
        FROM pg_locks
        WHERE locktype = 'advisory'
          AND pid != pg_backend_pid()
      `;
      const terminated = rows.filter((r) => r.terminated);
      if (terminated.length > 0) {
        this.logger.warn(
          `Released stale advisory locks by terminating ${terminated.length} backend(s): ${terminated.map((r) => r.pid).join(', ')}`,
        );
      }
    } catch (err) {
      // Non-fatal — log and continue. Cron jobs will simply skip until the lock clears naturally.
      this.logger.error('Failed to release stale advisory locks on startup', err);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
