import { Controller, Post, Body, Get, Patch, UseGuards, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { RequestingUser } from '../common/types/requesting-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Strict rate limit: 10 login attempts per minute per IP */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /** Strict rate limit: 10 login attempts per minute per IP */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  /** Exchange a valid refresh token for a new access + refresh token pair. */
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    if (!refreshToken) throw new UnauthorizedException('refreshToken required');
    return this.authService.refreshAccessToken(refreshToken);
  }

  /** Revoke the current refresh token (server-side logout). */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: RequestingUser) {
    await this.authService.revokeRefreshToken(user.userId);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: RequestingUser) {
    return this.authService.getUserById(user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@CurrentUser() user: RequestingUser, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.userId, dto);
  }

  @Patch('push-token')
  @UseGuards(JwtAuthGuard)
  async updatePushToken(
    @CurrentUser() user: RequestingUser,
    @Body('pushToken') pushToken: string | null,
  ) {
    await this.authService.updatePushToken(user.userId, pushToken ?? null);
    return { ok: true };
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@CurrentUser() user: RequestingUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  @Patch('notifications')
  @UseGuards(JwtAuthGuard)
  async updateNotificationPrefs(@CurrentUser() user: RequestingUser, @Body() dto: UpdateNotificationPrefsDto) {
    return this.authService.updateNotificationPrefs(user.userId, dto);
  }
}
