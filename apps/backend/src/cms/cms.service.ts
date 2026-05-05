import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AnnouncementTarget, CmsArticleType, CmsStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateArticleDto, UpdateArticleDto } from './dto/article.dto';
import {
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto';

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  // ─── Articles ─────────────────────────────────────────────────────────────

  async listArticles(filters?: {
    type?: CmsArticleType;
    status?: CmsStatus;
    locale?: string;
    pageKey?: string;
    translationKey?: string;
  }) {
    return this.prisma.cmsArticle.findMany({
      where: {
        type: filters?.type,
        status: filters?.status,
        locale: filters?.locale,
        pageKey: filters?.pageKey,
        translationKey: filters?.translationKey,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        type: true,
        status: true,
        locale: true,
        translationKey: true,
        pageKey: true,
        targetRole: true,
        sortOrder: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getArticle(id: string) {
    const article = await this.prisma.cmsArticle.findUnique({ where: { id } });
    if (!article) throw new NotFoundException(`Article ${id} not found`);
    return article;
  }

  async getArticleBySlug(slug: string) {
    const article = await this.prisma.cmsArticle.findUnique({ where: { slug } });
    if (!article) throw new NotFoundException(`Article "${slug}" not found`);
    return article;
  }

  async createArticle(dto: CreateArticleDto, authorId: string) {
    const existing = await this.prisma.cmsArticle.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" already in use`);

    return this.prisma.cmsArticle.create({
      data: {
        ...dto,
        authorId,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : undefined,
      },
    });
  }

  async updateArticle(id: string, dto: UpdateArticleDto) {
    await this.assertArticle(id);
    if (dto.slug) {
      const conflict = await this.prisma.cmsArticle.findFirst({
        where: { slug: dto.slug, NOT: { id } },
        select: { id: true },
      });
      if (conflict) throw new ConflictException(`Slug "${dto.slug}" already in use`);
    }
    const current = await this.prisma.cmsArticle.findUnique({ where: { id }, select: { status: true, publishedAt: true } });
    return this.prisma.cmsArticle.update({
      where: { id },
      data: {
        ...dto,
        publishedAt:
          dto.status === 'PUBLISHED' && current?.status !== 'PUBLISHED'
            ? new Date()
            : undefined,
      },
    });
  }

  async deleteArticle(id: string) {
    await this.assertArticle(id);
    await this.prisma.cmsArticle.delete({ where: { id } });
  }

  // ─── Public marketing site endpoints ─────────────────────────────────────

  /** List published articles for marketing site (blog feed, FAQs, etc.) */
  async listPublicArticles(filters?: {
    locale?: string;
    type?: CmsArticleType;
    pageKey?: string;
    translationKey?: string;
  }) {
    return this.prisma.cmsArticle.findMany({
      where: {
        status: 'PUBLISHED',
        locale: filters?.locale,
        type: filters?.type,
        pageKey: filters?.pageKey,
        translationKey: filters?.translationKey,
      },
      orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }],
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        type: true,
        locale: true,
        translationKey: true,
        pageKey: true,
        sortOrder: true,
        publishedAt: true,
      },
    });
  }

  /** Get a single published article by slug (+ optional locale) */
  async getPublicArticle(slug: string) {
    const article = await this.prisma.cmsArticle.findFirst({
      where: { slug, status: 'PUBLISHED' },
    });
    if (!article) throw new NotFoundException(`Article "${slug}" not found`);
    return article;
  }

  /** Get all published content blocks for a specific marketing page */
  async getPageContent(pageKey: string, locale: string) {
    return this.prisma.cmsArticle.findMany({
      where: { pageKey, locale, status: 'PUBLISHED' },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /** Get all locale variants of a content piece by translationKey */
  async getTranslations(translationKey: string) {
    return this.prisma.cmsArticle.findMany({
      where: { translationKey, status: 'PUBLISHED' },
      orderBy: { locale: 'asc' },
    });
  }

  // ─── Announcements ────────────────────────────────────────────────────────

  async listAnnouncements(activeOnly = false) {
    const now = new Date();
    return this.prisma.cmsAnnouncement.findMany({
      where: activeOnly
        ? {
            active: true,
            visibleFrom: { lte: now },
            OR: [{ visibleUntil: null }, { visibleUntil: { gte: now } }],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Public endpoint — returns active announcements for a given audience */
  async getActiveAnnouncements(target?: AnnouncementTarget) {
    const now = new Date();
    return this.prisma.cmsAnnouncement.findMany({
      where: {
        active: true,
        visibleFrom: { lte: now },
        AND: [
          { OR: [{ visibleUntil: null }, { visibleUntil: { gte: now } }] },
          target ? { OR: [{ target: 'ALL' }, { target }] } : { target: 'ALL' },
        ],
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        body: true,
        severity: true,
        target: true,
        visibleUntil: true,
      },
    });
  }

  async createAnnouncement(dto: CreateAnnouncementDto, authorId: string) {
    return this.prisma.cmsAnnouncement.create({
      data: {
        ...dto,
        authorId,
        visibleFrom: dto.visibleFrom ? new Date(dto.visibleFrom) : new Date(),
        visibleUntil: dto.visibleUntil ? new Date(dto.visibleUntil) : undefined,
      },
    });
  }

  async updateAnnouncement(id: string, dto: UpdateAnnouncementDto) {
    await this.assertAnnouncement(id);
    return this.prisma.cmsAnnouncement.update({
      where: { id },
      data: {
        ...dto,
        visibleFrom: dto.visibleFrom ? new Date(dto.visibleFrom) : undefined,
        visibleUntil: dto.visibleUntil ? new Date(dto.visibleUntil) : undefined,
      },
    });
  }

  async deleteAnnouncement(id: string) {
    await this.assertAnnouncement(id);
    await this.prisma.cmsAnnouncement.delete({ where: { id } });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async assertArticle(id: string) {
    const a = await this.prisma.cmsArticle.findUnique({ where: { id }, select: { id: true } });
    if (!a) throw new NotFoundException(`Article ${id} not found`);
  }

  private async assertAnnouncement(id: string) {
    const a = await this.prisma.cmsAnnouncement.findUnique({ where: { id }, select: { id: true } });
    if (!a) throw new NotFoundException(`Announcement ${id} not found`);
  }
}
