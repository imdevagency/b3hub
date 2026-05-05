/**
 * SocialService — stub implementations for social platform OAuth + publishing.
 *
 * Each method is intentionally skeletal. Credentials are read from environment
 * variables so the module is safe to deploy without any keys configured —
 * calls simply return a "not_configured" result until you wire up real tokens.
 *
 * Integration steps per platform:
 *  META     — Set META_APP_ID + META_APP_SECRET in .env, then implement
 *             the pages_manage_posts / instagram_content_publish flows.
 *  LINKEDIN — Set LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET, implement
 *             w_organization_social flow.
 *  GOOGLE   — Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET, implement
 *             My Business API post flow.
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PublishSocialPostDto, SocialPlatform } from './dto/publish-post.dto';

export interface SocialConnectionStatus {
  platform: SocialPlatform;
  configured: boolean;
  /** true when OAuth tokens are persisted in DB (not yet implemented) */
  connected: boolean;
  accountName?: string;
}

export interface PublishResult {
  platform: SocialPlatform;
  success: boolean;
  message: string;
  externalId?: string;
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(private readonly config: ConfigService) {}

  /** Returns configuration + connection status for all supported platforms. */
  getConnections(): SocialConnectionStatus[] {
    return [
      {
        platform: 'META',
        configured: !!(
          this.config.get('META_APP_ID') && this.config.get('META_APP_SECRET')
        ),
        connected: false, // replace with DB lookup once tokens are stored
      },
      {
        platform: 'LINKEDIN',
        configured: !!(
          this.config.get('LINKEDIN_CLIENT_ID') &&
          this.config.get('LINKEDIN_CLIENT_SECRET')
        ),
        connected: false,
      },
      {
        platform: 'GOOGLE',
        configured: !!(
          this.config.get('GOOGLE_CLIENT_ID') &&
          this.config.get('GOOGLE_CLIENT_SECRET')
        ),
        connected: false,
      },
    ];
  }

  /**
   * Returns the OAuth authorization URL for the requested platform.
   * Replace the placeholder strings with real OAuth library calls once
   * credentials are configured.
   */
  getOAuthUrl(platform: SocialPlatform, adminId: string): string {
    const callbackBase = this.config.get<string>('APP_URL') ?? 'https://yourdomain.com';
    const redirect = `${callbackBase}/api/v1/social/oauth/${platform.toLowerCase()}/callback`;

    // TODO: replace stubs with real OAuth library (e.g. simple-oauth2)
    const stubs: Record<SocialPlatform, string> = {
      META: `https://www.facebook.com/v20.0/dialog/oauth?client_id=${this.config.get('META_APP_ID') ?? 'NOT_CONFIGURED'}&redirect_uri=${encodeURIComponent(redirect)}&scope=pages_manage_posts,instagram_content_publish&state=${adminId}`,
      LINKEDIN: `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${this.config.get('LINKEDIN_CLIENT_ID') ?? 'NOT_CONFIGURED'}&redirect_uri=${encodeURIComponent(redirect)}&scope=w_organization_social+r_organization_social&state=${adminId}`,
      GOOGLE: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${this.config.get('GOOGLE_CLIENT_ID') ?? 'NOT_CONFIGURED'}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&scope=https://www.googleapis.com/auth/business.manage&state=${adminId}`,
      TIKTOK: 'NOT_SUPPORTED',
    };

    return stubs[platform];
  }

  /**
   * Handles the OAuth callback from a social platform.
   * TODO: exchange code for tokens and persist in DB.
   */
  handleOAuthCallback(platform: SocialPlatform, code: string, state: string): string {
    this.logger.log(`OAuth callback for ${platform} (state=${state}) — code exchange not yet implemented`);
    // TODO: exchange `code` for access + refresh tokens, store encrypted in DB
    // Return redirect URL back to the admin dashboard
    return '/dashboard/admin/marketing?tab=social&connected=' + platform.toLowerCase();
  }

  /**
   * Removes stored OAuth tokens for a platform.
   * TODO: delete tokens from DB.
   */
  disconnect(platform: SocialPlatform): { platform: SocialPlatform; disconnected: true } {
    this.logger.log(`Disconnect request for ${platform} — DB deletion not yet implemented`);
    // TODO: delete tokens from DB by platform + adminId
    return { platform, disconnected: true };
  }

  /**
   * Cross-publishes a post to one or more social platforms.
   * Returns per-platform results. Currently stubs — replace each block
   * with a real API call once credentials + tokens are wired.
   */
  async publish(dto: PublishSocialPostDto): Promise<PublishResult[]> {
    const results: PublishResult[] = [];

    for (const platform of dto.platforms) {
      try {
        const result = await this.publishToPlatform(platform, dto);
        results.push(result);
      } catch (err) {
        this.logger.error(`Failed to publish to ${platform}`, err);
        results.push({ platform, success: false, message: 'Publish failed — see logs' });
      }
    }

    return results;
  }

  private async publishToPlatform(
    platform: SocialPlatform,
    dto: PublishSocialPostDto,
  ): Promise<PublishResult> {
    switch (platform) {
      case 'META':
        // TODO: POST https://graph.facebook.com/v20.0/{page-id}/feed
        this.logger.log(`[META stub] Would publish: ${dto.text.slice(0, 60)}...`);
        return { platform, success: false, message: 'META integration not yet configured' };

      case 'LINKEDIN':
        // TODO: POST https://api.linkedin.com/v2/ugcPosts
        this.logger.log(`[LINKEDIN stub] Would publish: ${dto.text.slice(0, 60)}...`);
        return { platform, success: false, message: 'LinkedIn integration not yet configured' };

      case 'GOOGLE':
        // TODO: POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts
        this.logger.log(`[GOOGLE stub] Would publish: ${dto.text.slice(0, 60)}...`);
        return { platform, success: false, message: 'Google Business Profile integration not yet configured' };

      case 'TIKTOK':
        return { platform, success: false, message: 'TikTok integration not supported yet' };

      default:
        throw new NotFoundException(`Unknown platform: ${platform}`);
    }
  }
}
