import { Module } from '@nestjs/common';
import { CompanyMembersController } from './company-members.controller';
import { CompanyMembersService } from './company-members.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [CompanyMembersController],
  providers: [CompanyMembersService],
})
export class CompanyMembersModule {}
