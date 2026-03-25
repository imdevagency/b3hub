/**
 * Root NestJS module.
 * Imports every feature module, configures the global rate-limit throttler
 * (120 req/min per IP), and validates env variables via ConfigModule.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { MaterialsModule } from './materials/materials.module';
import { OrdersModule } from './orders/orders.module';
import { SkipHireModule } from './skip-hire/skip-hire.module';
import { DocumentsModule } from './documents/documents.module';
import { ProviderApplicationsModule } from './provider-applications/provider-applications.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { TransportJobsModule } from './transport-jobs/transport-jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { InvoicesModule } from './invoices/invoices.module';
import { CompanyModule } from './company/company.module';
import { CarrierSettingsModule } from './carrier-settings/carrier-settings.module';
import { DriverScheduleModule } from './driver-schedule/driver-schedule.module';
import { AdminModule } from './admin/admin.module';
import { QuoteRequestsModule } from './quote-requests/quote-requests.module';
import { ReviewsModule } from './reviews/reviews.module';
import { ChatModule } from './chat/chat.module';
import { ContainersModule } from './containers/containers.module';
import { RecyclingCentersModule } from './recycling-centers/recycling-centers.module';
import { EmailModule } from './email/email.module';
import { FrameworkContractsModule } from './framework-contracts/framework-contracts.module';
import { CompanyMembersModule } from './company-members/company-members.module';
import { MapsModule } from './maps/maps.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Global rate limits: 120 requests per minute per IP (generous default)
    // Individual routes can override with @Throttle()
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    MaterialsModule,
    OrdersModule,
    SkipHireModule,
    DocumentsModule,
    ProviderApplicationsModule,
    VehiclesModule,
    TransportJobsModule,
    NotificationsModule,
    InvoicesModule,
    CompanyModule,
    CarrierSettingsModule,
    DriverScheduleModule,
    AdminModule,
    QuoteRequestsModule,
    ReviewsModule,
    ChatModule,
    ContainersModule,
    RecyclingCentersModule,
    EmailModule,
    FrameworkContractsModule,
    CompanyMembersModule,
    MapsModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply throttle guard globally — individual endpoints can override with @Throttle()
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
