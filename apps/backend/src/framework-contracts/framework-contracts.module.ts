import { Module } from '@nestjs/common';
import { FrameworkContractsController } from './framework-contracts.controller';
import { FrameworkContractsService } from './framework-contracts.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FrameworkContractsController],
  providers: [FrameworkContractsService],
})
export class FrameworkContractsModule {}
