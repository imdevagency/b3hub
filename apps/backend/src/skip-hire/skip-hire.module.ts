import { Module } from '@nestjs/common';
import { SkipHireService } from './skip-hire.service';
import { SkipHireController } from './skip-hire.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SkipHireController],
  providers: [SkipHireService],
  exports: [SkipHireService],
})
export class SkipHireModule {}
