import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Acquires a PostgreSQL *transaction-level* advisory lock keyed on `lockName`.
 *
 * Unlike session-level locks, transaction-level advisory locks are automatically
 * released when the transaction ends (commit or rollback) — no explicit unlock
 * required. This makes them safe in connection-pooled environments (e.g. Supabase
 * pgBouncer) where the same DB session is not guaranteed across calls.
 *
 * The entire fn() is executed inside a single Prisma interactive transaction so
 * the lock lives for exactly the duration of the cron job.
 *
 * If another instance already holds the lock, logs a skip and returns immediately.
 *
 * `timeout` caps how long Prisma will wait for the transaction to complete
 * (default 10 minutes). Set lower for short crons.
 */
export async function withCronLock(
  prisma: PrismaService,
  lockName: string,
  fn: () => Promise<void>,
  logger: Logger,
  timeout = 600_000,
): Promise<void> {
  await (prisma as any).$transaction(
    async (tx: PrismaService) => {
      const [{ acquired }] = await (tx as any).$queryRaw<[{ acquired: boolean }]>`
        SELECT pg_try_advisory_xact_lock(hashtext(${lockName})::bigint) AS acquired
      `;
      if (!acquired) {
        logger.warn(`Cron "${lockName}" skipped — lock held by another instance`);
        return;
      }
      // Lock is held for the lifetime of this transaction — released automatically on commit/rollback.
      await fn();
    },
    { timeout },
  );
}
