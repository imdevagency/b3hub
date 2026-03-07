import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    const {
      email,
      password,
      firstName,
      lastName,
      userType,
      isCompany,
      companyId,
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

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        userType,
        isCompany: isCompany ?? false,
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

    // Generate token
    const token = this.generateToken(
      user.id,
      user.email ?? '',
      user.userType,
      user.isCompany,
      user.canSell,
      user.canTransport,
      user.company?.id,
      user.companyRole ?? undefined,
    );

    return {
      user,
      token,
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
      user.company?.id,
      user.companyRole ?? undefined,
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
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
        company: {
          select: {
            id: true,
            name: true,
            companyType: true,
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

  private generateToken(
    userId: string,
    email: string,
    userType: string,
    isCompany: boolean,
    canSell: boolean,
    canTransport: boolean,
    companyId?: string,
    companyRole?: string,
  ): string {
    const payload = {
      sub: userId,
      email,
      userType,
      isCompany,
      canSell,
      canTransport,
      companyId,
      companyRole,
    };
    return this.jwtService.sign(payload);
  }
}
