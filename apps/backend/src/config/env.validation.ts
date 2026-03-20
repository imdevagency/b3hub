import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
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

  @IsString()
  @IsOptional()
  ALLOWED_ORIGIN?: string;

  // ── Auth ─────────────────────────────────────────────────────────────────

  @IsString()
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

  // ── Google Maps (server-side only key) ──────────────────────────────────

  @IsString()
  @IsOptional()
  GOOGLE_MAPS_SERVER_API_KEY?: string;
}

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

  return validatedConfig;
}
