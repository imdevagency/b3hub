import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Declares every environment variable the backend reads.
 * Required vars throw at startup if missing; optional vars carry sensible
 * defaults so the app still works in development without a full .env file.
 *
 * Additional production-only validation is done in validateEnv() below.
 */
class EnvironmentVariables {
  // ── App ──────────────────────────────────────────────────────────────────

  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @IsOptional()
  PORT: number = 3000;

  /** Primary CORS allowlist key */
  @IsString()
  @IsOptional()
  ALLOWED_ORIGIN?: string;

  /** Legacy alias — use ALLOWED_ORIGIN in new deployments */
  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  // ── Auth ─────────────────────────────────────────────────────────────────

  /** Minimum 32 characters to ensure sufficient entropy for JWT signing. */
  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  // ── Database ─────────────────────────────────────────────────────────────

  @IsString()
  DATABASE_URL!: string;

  // ── Email (Resend) ────────────────────────────────────────────────────────

  /** If absent, emails are logged to console only — safe for development. */
  @IsString()
  @IsOptional()
  RESEND_API_KEY?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsUrl({ require_tld: false })
  @IsOptional()
  WEB_URL?: string;

  // ── Supabase storage ─────────────────────────────────────────────────────

  @IsUrl({ require_tld: false })
  @IsOptional()
  SUPABASE_URL?: string;

  /** Primary service-role key */
  @IsString()
  @IsOptional()
  SUPABASE_KEY?: string;

  /** Public anon key (fallback alias for SUPABASE_KEY) */
  @IsString()
  @IsOptional()
  SUPABASE_ANON_KEY?: string;

  // ── Stripe payments ──────────────────────────────────────────────────────

  /** Secret key (sk_live_* in production, sk_test_* in dev). */
  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  /** Webhook signing secret (whsec_*) from the Stripe dashboard. */
  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;

  // ── Google Maps (server-side only key) ──────────────────────────────────

  @IsString()
  @IsOptional()
  GOOGLE_MAPS_SERVER_API_KEY?: string;

  // ── Sentry (error monitoring) ────────────────────────────────────────────

  /** If absent, errors are only logged to console. */
  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;
}

/** Secrets that must be present when NODE_ENV=production. */
const REQUIRED_IN_PRODUCTION: Array<keyof EnvironmentVariables> = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'SENTRY_DSN',
  'ALLOWED_ORIGIN',
  'RESEND_API_KEY',
];

/**
 * Called by ConfigModule at bootstrap.
 * Throws a descriptive error if any required variable is missing or invalid,
 * preventing the app from starting with a broken configuration.
 */
export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors
        .map(
          (e) =>
            `  • ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
        )
        .join('\n')}`,
    );
  }

  // Production-only: fail hard if any critical secret is absent.
  if (validatedConfig.NODE_ENV === Environment.Production) {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => !validatedConfig[key]);
    if (missing.length > 0) {
      throw new Error(
        `Production startup blocked — missing required secrets:\n${missing.map((k) => `  • ${k}`).join('\n')}\n` +
          'Set these environment variables before deploying.',
      );
    }
  }

  return validatedConfig;
}

