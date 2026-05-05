import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AnnouncementTarget, CmsArticleType, CmsStatus } from '@prisma/client';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestingUser } from '../common/types/requesting-user.interface';
import { CmsService } from './cms.service';
import { CreateArticleDto, UpdateArticleDto } from './dto/article.dto';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

function assertAdmin(user: RequestingUser) {
  if (user.userType !== 'ADMIN') throw new ForbiddenException();
}

@Controller('cms')
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  // ─── Public: active announcements ─────────────────────────────────────────

  @Get('announcements/active')
  @UseGuards(OptionalJwtAuthGuard)
  getActive(@Query('target') target?: AnnouncementTarget) {
    return this.cmsService.getActiveAnnouncements(target);
  }

  // ─── Public: marketing site articles ──────────────────────────────────────

  @Get('public/articles')
  listPublicArticles(
    @Query('locale') locale?: string,
    @Query('type') type?: CmsArticleType,
    @Query('pageKey') pageKey?: string,
    @Query('translationKey') translationKey?: string,
  ) {
    return this.cmsService.listPublicArticles({ locale, type, pageKey, translationKey });
  }

  @Get('public/articles/:slug')
  getPublicArticle(@Param('slug') slug: string) {
    return this.cmsService.getPublicArticle(slug);
  }

  @Get('public/page/:pageKey')
  getPageContent(
    @Param('pageKey') pageKey: string,
    @Query('locale') locale: string = 'lv',
  ) {
    return this.cmsService.getPageContent(pageKey, locale);
  }

  @Get('public/translations/:translationKey')
  getTranslations(@Param('translationKey') translationKey: string) {
    return this.cmsService.getTranslations(translationKey);
  }

  // ─── Public: published articles by slug ───────────────────────────────────

  @Get('articles/slug/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.cmsService.getArticleBySlug(slug);
  }

  // ─── Admin: articles ───────────────────────────────────────────────────────

  @Get('articles')
  @UseGuards(JwtAuthGuard)
  listArticles(
    @CurrentUser() user: RequestingUser,
    @Query('type') type?: CmsArticleType,
    @Query('status') status?: CmsStatus,
    @Query('locale') locale?: string,
    @Query('pageKey') pageKey?: string,
    @Query('translationKey') translationKey?: string,
  ) {
    assertAdmin(user);
    return this.cmsService.listArticles({ type, status, locale, pageKey, translationKey });
  }

  @Get('articles/:id')
  @UseGuards(JwtAuthGuard)
  getArticle(@CurrentUser() user: RequestingUser, @Param('id') id: string) {
    assertAdmin(user);
    return this.cmsService.getArticle(id);
  }

  @Post('articles')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  createArticle(
    @CurrentUser() user: RequestingUser,
    @Body() dto: CreateArticleDto,
  ) {
    assertAdmin(user);
    return this.cmsService.createArticle(dto, user.id);
  }

  @Patch('articles/:id')
  @UseGuards(JwtAuthGuard)
  updateArticle(
    @CurrentUser() user: RequestingUser,
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
  ) {
    assertAdmin(user);
    return this.cmsService.updateArticle(id, dto);
  }

  @Delete('articles/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  deleteArticle(@CurrentUser() user: RequestingUser, @Param('id') id: string) {
    assertAdmin(user);
    return this.cmsService.deleteArticle(id);
  }

  // ─── Admin: announcements ─────────────────────────────────────────────────

  @Get('announcements')
  @UseGuards(JwtAuthGuard)
  listAnnouncements(@CurrentUser() user: RequestingUser) {
    assertAdmin(user);
    return this.cmsService.listAnnouncements();
  }

  @Post('announcements')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  createAnnouncement(
    @CurrentUser() user: RequestingUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    assertAdmin(user);
    return this.cmsService.createAnnouncement(dto, user.id);
  }

  @Patch('announcements/:id')
  @UseGuards(JwtAuthGuard)
  updateAnnouncement(
    @CurrentUser() user: RequestingUser,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    assertAdmin(user);
    return this.cmsService.updateAnnouncement(id, dto);
  }

  @Delete('announcements/:id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  deleteAnnouncement(
    @CurrentUser() user: RequestingUser,
    @Param('id') id: string,
  ) {
    assertAdmin(user);
    return this.cmsService.deleteAnnouncement(id);
  }
}
