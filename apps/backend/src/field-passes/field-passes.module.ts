import { Module } from '@nestjs/common';
import { FieldPassesController } from './field-passes.controller';
import { FieldPassesService } from './field-passes.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [PrismaModule, SupabaseModule],
  controllers: [FieldPassesController],
  providers: [FieldPassesService],
  exports: [FieldPassesService],
})
export class FieldPassesModule {}
