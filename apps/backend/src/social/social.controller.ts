/**
 * SocialController — /api/v1/social
 *
 * Admin-only endpoints for social platform OAuth connection management
 * and cross-posting.
 *
 * All routes require JwtAuthGuard + AdminGuard.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Redirect,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { PublishSocialPostDto, type SocialPlatform } from './dto/publish-post.dto';

const VALID_PLATFORMS: SocialPlatform[] = ['META', 'LINKEDIN', 'GOOGLE', 'TIKTOK'];

@Controller('social')
@UseGuards(JwtAuthGuard, AdminGuard)
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  /** GET /api/v1/social/connections — list all platform connection statuses */
  @Get('connections')
  getConnections() {
    return this.socialService.getConnections();
  }

  /**
   * GET /api/v1/social/oauth/:platform
   * Redirects the browser to the platform's OAuth authorization page.
   * Remove the AdminGuard if you want staff to connect without full ADMIN role.
   */
  @Get('oauth/:platform')
  @Redirect()
  initiateOAuth(
    @Param('platform') platform: string,
    @CurrentUser() user: RequestingUser,
  ) {
    const p = platform.toUpperCase() as SocialPlatform;
    const url = this.socialService.getOAuthUrl(p, user.id);
    return { url };
  }

  /**
   * GET /api/v1/social/oauth/:platform/callback
   * Receives the OAuth code from the platform and redirects back to the
   * admin dashboard. This endpoint is called by the external platform, so
   * it does NOT require JwtAuthGuard — the `state` param carries the admin ID.
   *
   * Override @UseGuards to remove auth requirement for this specific route.
   */
  @Get('oauth/:platform/callback')
  @UseGuards() // override class-level guard — platform redirects here without JWT
  @Redirect()
  oauthCallback(
    @Param('platform') platform: string,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    const p = platform.toUpperCase() as SocialPlatform;
    const redirectPath = this.socialService.handleOAuthCallback(p, code ?? '', state ?? '');
    return { url: redirectPath };
  }

  /**
   * DELETE /api/v1/social/connections/:platform
   * Removes stored OAuth tokens for a platform.
   */
  @Delete('connections/:platform')
  disconnect(@Param('platform') platform: string) {
    const p = platform.toUpperCase() as SocialPlatform;
    return this.socialService.disconnect(p);
  }

  /**
   * POST /api/v1/social/publish
   * Cross-publishes a post to one or more platforms.
   *
   * Body: { text, platforms, title?, linkUrl?, imageUrl? }
   */
  @Post('publish')
  publish(@Body() dto: PublishSocialPostDto) {
    return this.socialService.publish(dto);
  }
}
