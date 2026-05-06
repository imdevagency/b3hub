import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class UpdateJumisSettingsDto {
  @IsString()
  username: string; // Jumis cloud e-mail address

  @IsString()
  password: string; // SQL password for the Jumis cloud database

  @IsString()
  database: string; // Jumis database name

  @IsOptional()
  @IsBoolean()
  enabled?: boolean; // whether the integration is active
}

export class JumisSyncRequestDto {
  /**
   * Type of objects to push into Jumis.
   * "invoices"  → financial documents (kases / bankas darījumi)
   * "partners"  → partner cards (customers / companies)
   */
  @IsIn(['invoices', 'partners'])
  syncType: 'invoices' | 'partners';

  /**
   * Optional ISO date range filter — only sync records created/updated after this date.
   * Format: ISO 8601 string e.g. "2024-01-01T00:00:00.000Z"
   */
  @IsOptional()
  @IsString()
  since?: string;
}
