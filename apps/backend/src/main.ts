/**
 * Application entry point.
 * Creates the NestJS app, applies global middleware (CORS, validation pipe,
 * exception filter, rate-throttler guard) and starts the HTTP server on PORT.
 */
// IMPORTANT: instrument.ts must be imported before anything else so Sentry
// can instrument all modules (NestJS, Prisma, HTTP) from the start.
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json } from 'express';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter, AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // rawBody is required for Stripe webhook signature verification
    rawBody: true,
  });

  // Trust the first hop from a reverse proxy (Railway, Fly.io, Render, etc.).
  // Required for req.ip to reflect the real client IP, not the proxy.
  // Must be set before any middleware that reads req.ip.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // HTTPS redirect in production — runs before all other middleware.
  // x-forwarded-proto is set by the reverse proxy to 'https' when the
  // client used TLS. Any plain-http request gets a permanent redirect.
  if (process.env.NODE_ENV === 'production') {
    app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
      if (req.headers['x-forwarded-proto'] !== 'https') {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
  }

  // Increase JSON body limit to support base64-encoded photo uploads
  app.use(json({ limit: '10mb' }));

  // HTTP security headers with production-grade HSTS
  app.use(
    helmet({
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // CORS — tight in production, open in development
  // Reads ALLOWED_ORIGIN or CORS_ORIGIN (comma-separated list of origins)
  const rawOrigin =
    process.env.ALLOWED_ORIGIN ?? process.env.CORS_ORIGIN;
  const allowedOrigin = rawOrigin
    ? rawOrigin.split(',').map((o) => o.trim())
    : process.env.NODE_ENV === 'production'
      ? false
      : true;
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filters — AllExceptionsFilter is the catch-all (outermost),
  // HttpExceptionFilter handles NestJS HttpExceptions with structured logging.
  // Filters are applied last-in-first-out, so AllExceptionsFilter is outermost.
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  // Swagger UI — available at /api/docs in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('B3Hub API')
      .setDescription('B3Hub construction logistics platform — REST API reference')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT',
      )
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    new Logger('Swagger').log('Docs available at http://localhost:3000/api/docs');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  const bootstrapLogger = new Logger('Bootstrap');
  const scheme = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  bootstrapLogger.log(
    `Application is running on: ${scheme}://0.0.0.0:${port}`,
  );
  if (process.env.NODE_ENV === 'production') {
    bootstrapLogger.log('HTTPS enforced: HTTP requests will be redirected to HTTPS (301)');
    bootstrapLogger.log('HSTS: max-age=31536000; includeSubDomains; preload');
  }
}
void bootstrap();
