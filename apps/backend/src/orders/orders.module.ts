import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { UpdatesModule } from '../updates/updates.module';
import { MaterialsModule } from '../materials/materials.module';
import { DocumentsModule } from '../documents/documents.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { MapsModule } from '../maps/maps.module';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    PaymentsModule,
    InvoicesModule,
    UpdatesModule,
    MaterialsModule,
    DocumentsModule,
    SupabaseModule,
    MapsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
