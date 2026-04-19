import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Acquires a PostgreSQL session-level advisory lock keyed on `lockName`.
 *
 * If another instance already holds the lock, logs a skip message and returns
 * immediately — preventing duplicate cron execution in multi-replica deployments.
 *
 * The lock is released in a `finally` block so it is always freed even if `fn`
 * throws. Uses `hashtext(lockName)::bigint` for a stable integer key.
 */
export async function withCronLock(
  prisma: PrismaService,
  lockName: string,
  fn: () => Promise<void>,
  logger: Logger,
): Promise<void> {
  const [{ acquired }] = await prisma.$queryRaw<[{ acquired: boolean }]>`
    SELECT pg_try_advisory_lock(hashtext(${lockName})::bigint) AS acquired
  `;
  if (!acquired) {
    logger.warn(`Cron "${lockName}" skipped — lock held by another instance`);
    return;
  }
  try {
    await fn();
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(hashtext(${lockName})::bigint)`.catch(
      (err: unknown) =>
        logger.error(
          `Failed to release cron lock "${lockName}"`,
          (err as Error).message,
        ),
    );
  }
}
