/**
 * Core authentication service.
 * User registration (bcrypt hashing), login (JWT + 30-day refresh token),
 * token refresh, server-side logout, password reset flow (email via Resend),
 * profile updates, and notification preference management.
 */
import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_TOKEN_BYTES = 48; // 384 bits — opaque, URL-safe
const REFRESH_TOKEN_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private email: EmailService,
  ) {}

  async register(registerDto: RegisterDto) {
    const {
      email,
      password,
      firstName,
      lastName,
      roles = ['BUYER'],
      isCompany,
      companyId,
      phone,
      companyName,
      regNumber,
    } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user — always BUYER type; extra roles become provider applications
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        userType: 'BUYER',
        isCompany: isCompany ?? roles.some((r) => r !== 'BUYER'),
        companyId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        userType: true,
        isCompany: true,
        canSell: true,
        canTransport: true,
        canSkipHire: true,
        companyRole: true,
        status: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Auto-create provider application if roles include SUPPLIER or CARRIER
    const appliesForSell = roles.includes('SUPPLIER');
    const appliesForTransport = roles.includes('CARRIER');
    if (appliesForSell || appliesForTransport) {
      await this.prisma.providerApplication.create({
        data: {
          email,
          firstName,
          lastName,
          phone: phone ?? '',
          companyName: companyName ?? `${firstName} ${lastName}`,
          regNumber,
          appliesForSell,
          appliesForTransport,
          userId: user.id,
        },
      });
    }

    // Generate token
    const token = this.generateToken(
      user.id,
      user.email ?? '',
      user.userType,
      user.isCompany,
      user.canSell,
      user.canTransport,
      user.canSkipHire,
      user.company?.id,
      user.companyRole ?? undefined,
    );

    // Send welcome email (non-blocking)
    this.email.sendWelcome(email, firstName ?? email).catch(() => null);

    const { rawToken: refreshToken } = await this.issueRefreshToken(user.id);

    this.logger.log(`User ${user.id} registered (${email})`);
    return {
      user,
      token,
      refreshToken,
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            companyType: true,
            payoutEnabled: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (user.status !== 'ACTIVE' && user.status !== 'PENDING') {
      throw new UnauthorizedException('Account is not active');
    }

    // Generate token
    const token = this.generateToken(
      user.id,
      user.email ?? '',
      user.userType,
      user.isCompany,
      user.canSell,
      user.canTransport,
      user.canSkipHire,
      user.company?.id,
      user.companyRole ?? undefined,
      {
        permCreateContracts: user.permCreateContracts ?? false,
        permReleaseCallOffs: user.permReleaseCallOffs ?? false,
        permManageOrders: user.permManageOrders ?? false,
        permViewFinancials: user.permViewFinancials ?? false,
        permManageTeam: user.permManageTeam ?? false,
      },
      user.company?.payoutEnabled ?? false,
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    const { rawToken: refreshToken } = await this.issueRefreshToken(user.id);

    this.logger.log(`User ${user.id} logged in (${email})`);
    return {
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _, ...result } = user;
      return result;
    }

    return null;
  }

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        userType: true,
        isCompany: true,
        canSell: true,
        canTransport: true,
        canSkipHire: true,
        companyRole: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        notifPush: true,
        notifOrderUpdates: true,
        notifJobAlerts: true,
        notifMarketing: true,
        permCreateContracts: true,
        permReleaseCallOffs: true,
        permManageOrders: true,
        permViewFinancials: true,
        permManageTeam: true,
        company: {
          select: {
            id: true,
            name: true,
            companyType: true,
          },
        },
        buyerProfile: {
          select: {
            creditLimit: true,
            creditUsed: true,
            paymentTerms: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Compute available dashboard modes server-side — single source of truth
    const modes: string[] = [];
    const isAdmin = user.userType === 'ADMIN';
    const isTransport = user.canTransport;
    // A pure-transport individual (driver with no company/sell) doesn't get buyer mode
    const isPureTransportIndividual =
      isTransport && !user.canSell && !user.isCompany;
    if (isAdmin || (user.userType === 'BUYER' && !isPureTransportIndividual))
      modes.push('BUYER');
    if (isAdmin || user.canSell) modes.push('SUPPLIER');
    if (isAdmin || isTransport) modes.push('CARRIER');

    return { ...user, availableModes: modes.length > 0 ? modes : ['BUYER'] };
  }

  async updatePushToken(userId: string, pushToken: string | null) {
    await this.prisma.$executeRaw`
      UPDATE users SET "pushToken" = ${pushToken} WHERE id = ${userId}
    `;
    return { id: userId };
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; phone?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        userType: true,
        isCompany: true,
        canSell: true,
        canTransport: true,
        status: true,
      },
    });
  }

  async forgotPassword(
    email: string,
  ): Promise<{ ok: boolean; _devResetUrl?: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return ok to prevent user enumeration
    if (!user) return { ok: true };

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashed, resetTokenExpiry: expiry },
    });

    // Send password reset email
    this.email
      .sendPasswordReset(user.email ?? '', user.firstName ?? '', rawToken)
      .catch(() => null);

    // Surface raw token in dev for testing without a real email
    const isDev = process.env.NODE_ENV !== 'production';
    return {
      ok: true,
      ...(isDev && {
        _devResetUrl: `/reset-password?token=${rawToken}`,
      }),
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ ok: boolean }> {
    const hashed = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: hashed,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { ok: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new BadRequestException('Esošā parole nav pareiza');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });
    return { ok: true };
  }

  async updateNotificationPrefs(
    userId: string,
    prefs: {
      notifPush?: boolean;
      notifOrderUpdates?: boolean;
      notifJobAlerts?: boolean;
      notifMarketing?: boolean;
    },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(prefs.notifPush !== undefined && { notifPush: prefs.notifPush }),
        ...(prefs.notifOrderUpdates !== undefined && {
          notifOrderUpdates: prefs.notifOrderUpdates,
        }),
        ...(prefs.notifJobAlerts !== undefined && {
          notifJobAlerts: prefs.notifJobAlerts,
        }),
        ...(prefs.notifMarketing !== undefined && {
          notifMarketing: prefs.notifMarketing,
        }),
      },
      select: {
        notifPush: true,
        notifOrderUpdates: true,
        notifJobAlerts: true,
        notifMarketing: true,
      },
    });
  }

  // ── Refresh token helpers ───────────────────────────────────────────────────

  /** Issue a new opaque refresh token, persist its hash, return the raw value. */
  private async issueRefreshToken(
    userId: string,
  ): Promise<{ rawToken: string }> {
    const rawToken = crypto
      .randomBytes(REFRESH_TOKEN_BYTES)
      .toString('base64url');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.$executeRaw`
      UPDATE users
      SET "refreshToken" = ${hashed}, "refreshTokenExpiry" = ${expiry}
      WHERE id = ${userId}
    `;

    return { rawToken };
  }

  /** Validate a raw refresh token and return a new access token + rolling refresh token. */
  async refreshAccessToken(rawRefreshToken: string) {
    const hashed = crypto
      .createHash('sha256')
      .update(rawRefreshToken)
      .digest('hex');

    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        email: string | null;
        userType: string;
        isCompany: boolean;
        canSell: boolean;
        canTransport: boolean;
        canSkipHire: boolean;
        companyId: string | null;
        companyRole: string | null;
        permCreateContracts: boolean;
        permReleaseCallOffs: boolean;
        permManageOrders: boolean;
        permViewFinancials: boolean;
        permManageTeam: boolean;
        refreshTokenExpiry: Date | null;
        payoutEnabled: boolean | null;
      }[]
    >`
      SELECT u.id, u.email, u."userType", u."isCompany", u."canSell", u."canTransport", u."canSkipHire",
             u."companyId", u."companyRole",
             u."permCreateContracts", u."permReleaseCallOffs", u."permManageOrders",
             u."permViewFinancials", u."permManageTeam", u."refreshTokenExpiry",
             c."payoutEnabled"
      FROM users u
      LEFT JOIN companies c ON u."companyId" = c.id
      WHERE u."refreshToken" = ${hashed}
      LIMIT 1
    `;

    const user = rows[0];
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    if (!user.refreshTokenExpiry || user.refreshTokenExpiry < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // Rolling window — issue a new refresh token on each use
    const { rawToken: newRefreshToken } = await this.issueRefreshToken(user.id);

    const token = this.generateToken(
      user.id,
      user.email ?? '',
      user.userType,
      user.isCompany,
      user.canSell,
      user.canTransport,
      user.canSkipHire,
      user.companyId ?? undefined,
      user.companyRole ?? undefined,
      {
        permCreateContracts: user.permCreateContracts,
        permReleaseCallOffs: user.permReleaseCallOffs,
        permManageOrders: user.permManageOrders,
        permViewFinancials: user.permViewFinancials,
        permManageTeam: user.permManageTeam,
      },
      user.payoutEnabled ?? false,
    );

    return { token, refreshToken: newRefreshToken };
  }

  /** Revoke a user's refresh token (logout). */
  async revokeRefreshToken(userId: string) {
    await this.prisma.$executeRaw`
      UPDATE users SET "refreshToken" = NULL, "refreshTokenExpiry" = NULL
      WHERE id = ${userId}
    `;
  }

  private generateToken(
    userId: string,
    email: string,
    userType: string,
    isCompany: boolean,
    canSell: boolean,
    canTransport: boolean,
    canSkipHire: boolean,
    companyId?: string,
    companyRole?: string,
    permissions?: {
      permCreateContracts: boolean;
      permReleaseCallOffs: boolean;
      permManageOrders: boolean;
      permViewFinancials: boolean;
      permManageTeam: boolean;
    },
    payoutEnabled?: boolean,
  ): string {
    const payload = {
      sub: userId,
      email,
      userType,
      isCompany,
      canSell,
      canTransport,
      canSkipHire,
      companyId,
      companyRole,
      permCreateContracts: permissions?.permCreateContracts ?? false,
      permReleaseCallOffs: permissions?.permReleaseCallOffs ?? false,
      permManageOrders: permissions?.permManageOrders ?? false,
      permViewFinancials: permissions?.permViewFinancials ?? false,
      permManageTeam: permissions?.permManageTeam ?? false,
      payoutEnabled: payoutEnabled ?? false,
    };
    return this.jwtService.sign(payload);
  }
}
