/**
 * Core authentication service.
 * User registration (bcrypt hashing), login (JWT + 30-day refresh token),
 * token refresh, server-side logout, password reset flow (email via Resend),
 * email verification, profile updates, and notification preference management.
 */
import {
  Injectable,
  Logger,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
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

const BCRYPT_ROUNDS = 12; // OWASP recommended minimum for 2024 hardware
const REFRESH_TOKEN_BYTES = 48; // 384 bits — opaque, URL-safe
const REFRESH_TOKEN_TTL_DAYS = 30;
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_FAILED_ATTEMPTS = 5; // lock after 5 consecutive failures
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

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
      phone,
      companyName,
      regNumber,
      termsAccepted,
    } = registerDto;

    // Terms must be explicitly accepted — guard at service layer too
    if (!termsAccepted) {
      throw new BadRequestException('You must accept the Terms of Service and Privacy Policy to register.');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password with OWASP-recommended cost factor
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Generate email verification token
    const { rawToken: rawVerifyToken, hashed: hashedVerifyToken, expiry: verifyExpiry } =
      this.generateSecureToken(EMAIL_VERIFY_TTL_MS);

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
        termsAcceptedAt: new Date(),
        emailVerifyToken: hashedVerifyToken,
        emailVerifyExpiry: verifyExpiry,
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
        permCreateContracts: true,
        permReleaseCallOffs: true,
        permManageOrders: true,
        permViewFinancials: true,
        permManageTeam: true,
        tokenVersion: true,
        status: true,
        company: {
          select: {
            id: true,
            name: true,
            payoutEnabled: true,
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
      {
        permCreateContracts: user.permCreateContracts ?? false,
        permReleaseCallOffs: user.permReleaseCallOffs ?? false,
        permManageOrders: user.permManageOrders ?? false,
        permViewFinancials: user.permViewFinancials ?? false,
        permManageTeam: user.permManageTeam ?? false,
      },
      user.company?.payoutEnabled ?? false,
      user.tokenVersion ?? 0,
    );

    // Send welcome + verification emails (non-blocking)
    this.email.sendEmailVerification(email, firstName ?? email, rawVerifyToken).catch(() => null);
    this.email.sendWelcome(email, firstName ?? email).catch(() => null);

    const { rawToken: refreshToken } = await this.issueRefreshToken(user.id);

    this.logger.log(`User ${user.id} registered (${email})`);
    return {
      user,
      token,
      refreshToken,
    };
  }

  async login(loginDto: LoginDto, ip?: string) {
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

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const secondsLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      this.logger.warn(`AUTH_LOCKED userId=${user.id} email=${email} ip=${ip ?? 'unknown'} remainingSecs=${secondsLeft}`);
      throw new ForbiddenException(
        `Account temporarily locked. Try again in ${secondsLeft} seconds.`,
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });
      if (shouldLock) {
        this.logger.warn(`AUTH_LOCKOUT userId=${user.id} email=${email} ip=${ip ?? 'unknown'} attempts=${attempts}`);
      } else {
        this.logger.warn(`AUTH_FAIL email=${email} ip=${ip ?? 'unknown'} attempts=${attempts}`);
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset lockout counters on successful authentication
    if ((user.failedLoginAttempts ?? 0) > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    // Check if user is active
    if (user.status !== 'ACTIVE' && user.status !== 'PENDING') {
      this.logger.warn(`AUTH_SUSPENDED userId=${user.id} email=${email} ip=${ip ?? 'unknown'} status=${user.status}`);
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
      user.tokenVersion ?? 0,
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    const { rawToken: refreshToken } = await this.issueRefreshToken(user.id);

    this.logger.log(`AUTH_SUCCESS userId=${user.id} email=${email} ip=${ip ?? 'unknown'}`);
    return {
      user: userWithoutPassword,
      token,
      refreshToken,
    };
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
    // Admins operate exclusively in the admin panel — no buyer/supplier/carrier modes
    if (user.userType === 'ADMIN') {
      return { ...user, availableModes: [] };
    }

    const modes: string[] = [];
    const isTransport = user.canTransport;
    // A pure-transport individual (driver with no company/sell) doesn't get buyer mode
    const isPureTransportIndividual =
      isTransport && !user.canSell && !user.isCompany;
    if (user.userType === 'BUYER' && !isPureTransportIndividual) modes.push('BUYER');
    if (user.canSell) modes.push('SUPPLIER');
    if (isTransport) modes.push('CARRIER');

    return { ...user, availableModes: modes.length > 0 ? modes : ['BUYER'] };
  }

  /** Verify email address using the token sent during registration. */
  async verifyEmail(rawToken: string): Promise<{ ok: boolean }> {
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: hashed,
        emailVerifyExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpiry: null,
      },
    });

    this.logger.log(`Email verified for user ${user.id}`);
    return { ok: true };
  }

  /** Re-send the verification email to the authenticated user. */
  async resendVerification(userId: string): Promise<{ ok: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, emailVerified: true },
    });

    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const { rawToken, hashed, expiry } = this.generateSecureToken(EMAIL_VERIFY_TTL_MS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: hashed, emailVerifyExpiry: expiry },
    });

    this.email
      .sendEmailVerification(user.email ?? '', user.firstName ?? '', rawToken)
      .catch(() => null);

    return { ok: true };
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

    const { rawToken, hashed, expiry } = this.generateSecureToken(60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashed, resetTokenExpiry: expiry },
    });

    // Send password reset email
    this.email
      .sendPasswordReset(user.email ?? '', user.firstName ?? '', rawToken)
      .catch(() => null);

    // Surface raw token only when explicitly enabled — never in production
    const exposeDevToken =
      process.env.NODE_ENV !== 'production' &&
      process.env.EXPOSE_DEV_RESET_URL === 'true';
    return {
      ok: true,
      ...(exposeDevToken && {
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

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update(
      {
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
          // Revoke all sessions so stolen-then-reset tokens can't still log in
          refreshToken: null,
          refreshTokenExpiry: null,
        },
      },
    );

    return { ok: true };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Check lockout (same mechanism as login)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const secondsLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      throw new ForbiddenException(
        `Account temporarily locked. Try again in ${secondsLeft} seconds.`,
      );
    }

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      // Increment failed attempts so brute-forcing via change-password is throttled
      const attempts = (user.failedLoginAttempts ?? 0) + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
        },
      });
      throw new BadRequestException('Esošā parole nav pareiza');
    }

    // Reset counters on success
    const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashed,
        failedLoginAttempts: 0,
        lockedUntil: null,
        // Revoke all other sessions so old tokens can't be replayed
        refreshToken: null,
        refreshTokenExpiry: null,
      },
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

  // ── Token helpers ───────────────────────────────────────────────────────────

  /**
   * Generate a cryptographically secure random token (hex), hash it for
   * storage, and compute an expiry timestamp.
   */
  private generateSecureToken(ttlMs: number): {
    rawToken: string;
    hashed: string;
    expiry: Date;
  } {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiry = new Date(Date.now() + ttlMs);
    return { rawToken, hashed, expiry };
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
        status: string;
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
        tokenVersion: number;
        payoutEnabled: boolean | null;
      }[]
    >`
      SELECT u.id, u.email, u."userType", u.status, u."isCompany", u."canSell", u."canTransport", u."canSkipHire",
             u."companyId", u."companyRole",
             u."permCreateContracts", u."permReleaseCallOffs", u."permManageOrders",
             u."permViewFinancials", u."permManageTeam", u."refreshTokenExpiry", u."tokenVersion",
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
    if (user.status !== 'ACTIVE' && user.status !== 'PENDING') {
      throw new UnauthorizedException('Account is suspended or deactivated');
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
      user.tokenVersion ?? 0,
    );

    return { token, refreshToken: newRefreshToken };
  }

  /**
   * Anonymise and deactivate a user account.
   * Hard-deleting is not safe because many FK relations lack cascade rules.
   * Anonymisation satisfies Apple guideline 5.1.1 and GDPR Art. 17.
   */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        // Replace all PII with anonymised placeholders
        email: `deleted_${userId}@deleted.b3hub.lv`,
        phone: null,
        firstName: 'Deleted',
        lastName: 'User',
        avatar: null,
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), BCRYPT_ROUNDS),
        // Revoke all tokens
        refreshToken: null,
        refreshTokenExpiry: null,
        resetToken: null,
        resetTokenExpiry: null,
        pushToken: null,
        // Lock the account permanently
        status: 'DEACTIVATED',
      },
    });

    this.logger.log(`Account anonymised and deactivated: ${userId}`);
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
    tokenVersion?: number,
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
      tokenVersion: tokenVersion ?? 0,
    };
    return this.jwtService.sign(payload);
  }
}
