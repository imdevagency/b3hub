/**
 * Global Prisma module.
 * Provides and exports PrismaService app-wide so every feature module can inject it
 * without individually importing PrismaModule.
 */
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
