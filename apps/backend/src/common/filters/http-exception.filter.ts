/**
 * Global HTTP exception filters.
 * HttpExceptionFilter formats NestJS HttpExceptions into a consistent JSON body
 * { statusCode, timestamp, path, message } and logs 4xx at warn level,
 * 5xx at error level — with method, path, and client IP for traceability.
 * AllExceptionsFilter is a catch-all for unexpected server errors (500).
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const error =
      typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : exceptionResponse;

    const logContext = `${request.method} ${request.originalUrl} [${request.ip ?? 'unknown'}]`;

    if (status >= 500) {
      this.logger.error(`${logContext} → ${status}`, exception.stack);
    } else if (status >= 400) {
      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as Record<string, unknown>)['message'] ??
            'client error');
      this.logger.warn(`${logContext} → ${status}: ${JSON.stringify(message)}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      ...error,
    });
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const logContext = `${request.method} ${request.originalUrl} [${request.ip ?? 'unknown'}]`;

    if (exception instanceof Error) {
      this.logger.error(
        `${logContext} → ${status}: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(`${logContext} → ${status}: ${String(exception)}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      message,
    });
  }
}
