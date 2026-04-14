/**
 * API Keys service.
 * Manages long-lived machine credentials for ERP / third-party integrations.
 *
 * Key format:  b3_live_<40 hex chars>
 * Storage:     only SHA-256(key) is persisted — plaintext shown once at creation
 * Auth:        ApiKeyGuard reads Authorization: Bearer b3_live_... and validates hash
 */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RequestingUser } from '../common/types/requesting-user.interface';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

const VALID_SCOPES = new Set([
  'orders:read',
  'orders:write',
  'invoices:read',
  'transport:read',
  'materials:read',
]);

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

  private assertOwnerOrManager(user: RequestingUser): void {
    if (user.companyRole !== 'OWNER' && user.companyRole !== 'MANAGER') {
      throw new ForbiddenException('Only company owners or managers can manage API keys');
    }
  }

  async create(user: RequestingUser, dto: CreateApiKeyDto) {
    if (!user.companyId) throw new ForbiddenException('No company associated with this account');
    this.assertOwnerOrManager(user);

    // Validate scopes
    const invalid = dto.scopes.filter((s) => !VALID_SCOPES.has(s));
    if (invalid.length) throw new BadRequestException(`Invalid scopes: ${invalid.join(', ')}`);

    // Generate key: b3_live_ + 40 random hex chars
    const rawKey = `b3_live_${randomBytes(20).toString('hex')}`;
    const keyHash = sha256(rawKey);
    const keyPrefix = rawKey.slice(0, 12); // "b3_live_xxxx"

    const record = await this.prisma.apiKey.create({
      data: {
        companyId: user.companyId,
        label: dto.label,
        keyHash,
        keyPrefix,
        scopes: dto.scopes,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: user.id,
      },
    });

    this.logger.log(`API key created: ${record.id} (${dto.label}) for company ${user.companyId}`);

    // Return the plaintext key exactly once
    return {
      id: record.id,
      label: record.label,
      key: rawKey, // shown once — not stored in DB
      keyPrefix: record.keyPrefix,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
    };
  }

  async list(user: RequestingUser) {
    if (!user.companyId) throw new ForbiddenException('No company associated with this account');
    this.assertOwnerOrManager(user);

    const keys = await this.prisma.apiKey.findMany({
      where: { companyId: user.companyId, revokedAt: null },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        createdById: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return keys;
  }

  async revoke(user: RequestingUser, keyId: string) {
    if (!user.companyId) throw new ForbiddenException('No company associated with this account');
    this.assertOwnerOrManager(user);

    const key = await this.prisma.apiKey.findFirst({
      where: { id: keyId, companyId: user.companyId },
    });
    if (!key) throw new NotFoundException('API key not found');
    if (key.revokedAt) throw new BadRequestException('API key is already revoked');

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`API key revoked: ${keyId} by user ${user.id}`);
    return { success: true };
  }

  /**
   * Validate a raw "b3_live_..." key and return the associated company context.
   * Called by ApiKeyGuard on every incoming request with a b3_live_ token.
   */
  async validateKey(rawKey: string): Promise<{
    companyId: string;
    scopes: string[];
    keyId: string;
  } | null> {
    if (!rawKey.startsWith('b3_live_')) return null;

    const hash = sha256(rawKey);
    const key = await this.prisma.apiKey.findUnique({
      where: { keyHash: hash },
      select: {
        id: true,
        companyId: true,
        scopes: true,
        revokedAt: true,
        expiresAt: true,
      },
    });

    if (!key) return null;
    if (key.revokedAt) return null;
    if (key.expiresAt && key.expiresAt < new Date()) return null;

    // Fire-and-forget lastUsedAt update
    this.prisma.apiKey
      .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});

    return { companyId: key.companyId, scopes: key.scopes, keyId: key.id };
  }
}
