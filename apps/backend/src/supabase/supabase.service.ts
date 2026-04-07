/**
 * Supabase client service.
 * Initialises the Supabase JS client from SUPABASE_URL / SUPABASE_KEY env vars.
 * Used for file storage (upload, signed URLs). Gracefully warns and disables
 * itself when credentials are not configured.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient | null = null;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key =
      this.config.get<string>('SUPABASE_KEY') ??
      this.config.get<string>('SUPABASE_ANON_KEY');
    if (url && key) {
      this.supabase = createClient(url, key);
    } else {
      this.logger.warn(
        'Supabase credentials not configured — Supabase features disabled.',
      );
    }
  }

  getClient(): SupabaseClient {
    if (!this.supabase) {
      throw new Error(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY in .env',
      );
    }
    return this.supabase;
  }

  // Storage example methods
  async uploadFile(bucket: string, path: string, file: Buffer) {
    const { data, error } = await this.getClient()
      .storage.from(bucket)
      .upload(path, file);

    if (error) throw error;
    return data;
  }

  getPublicUrl(bucket: string, path: string) {
    const { data } = this.getClient().storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  }

  /**
   * Create a short-lived signed URL for a private-bucket object.
   * Defaults to 1 hour. Use this instead of getPublicUrl() for sensitive files.
   */
  async createSignedUrl(
    bucket: string,
    path: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const { data, error } = await this.getClient()
      .storage.from(bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create signed URL: ${error?.message}`);
    }
    return data.signedUrl;
  }

  /**
   * Extract the storage object key (path within a bucket) from a Supabase
   * public URL.
   *
   * Public URL pattern:
   *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
   *
   * Returns null if the URL does not match the expected pattern.
   */
  static extractStoragePath(publicUrl: string, bucket: string): string | null {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length);
  }
}
