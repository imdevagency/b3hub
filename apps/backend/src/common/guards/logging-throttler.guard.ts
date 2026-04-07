/**
 * LoggingThrottlerGuard — extends the default NestJS ThrottlerGuard to emit a
 * structured warning log whenever a client hits a rate limit.
 *
 * Logs: RATE_LIMIT method path [ip] → limit details
 * This enables detection of unusual traffic patterns in log aggregation tools
 * (e.g. Datadog, Grafana Loki, CloudWatch) without requiring a separate agent.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class LoggingThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger('RateLimit');

  protected async throwThrottlingException(
    context: ExecutionContext,
  ): Promise<void> {
    const req = context.switchToHttp().getRequest<Request>();
    this.logger.warn(
      `RATE_LIMIT ${req.method} ${req.originalUrl} [${req.ip ?? 'unknown'}]`,
    );
    throw new ThrottlerException();
  }
}
