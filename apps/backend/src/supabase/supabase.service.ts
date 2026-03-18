import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient | null = null;
  private readonly logger = new Logger(SupabaseService.name);

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('SUPABASE_URL');
    const key = this.config.get<string>('SUPABASE_KEY') ?? this.config.get<string>('SUPABASE_ANON_KEY');
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

  async getPublicUrl(bucket: string, path: string) {
    const { data } = this.getClient().storage.from(bucket).getPublicUrl(path);

    return data.publicUrl;
  }
}
