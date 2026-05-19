/**
 * Root NestJS module.
 * Imports every feature module, configures the global rate-limit throttler
 * (120 req/min per IP), and validates env variables via ConfigModule.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggingThrottlerGuard } from './common/guards/logging-throttler.guard';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { MaterialsModule } from './materials/materials.module';
import { OrdersModule } from './orders/orders.module';
import { SkipHireModule } from './skip-hire/skip-hire.module';
import { ToiletCabinsModule } from './toilet-cabins/toilet-cabins.module';
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
import { ReviewsModule } from './reviews/reviews.module';
import { ChatModule } from './chat/chat.module';
import { ContainersModule } from './containers/containers.module';
import { RecyclingCentersModule } from './recycling-centers/recycling-centers.module';
import { EmailModule } from './email/email.module';
import { FrameworkContractsModule } from './framework-contracts/framework-contracts.module';
import { CompanyMembersModule } from './company-members/company-members.module';
import { MapsModule } from './maps/maps.module';
import { PaymentsModule } from './payments/payments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UpdatesModule } from './updates/updates.module';
import { HealthModule } from './health/health.module';
import { SavedAddressesModule } from './saved-addresses/saved-addresses.module';
import { PaymentMethodsModule } from './payment-methods/payment-methods.module';
import { DisputesModule } from './disputes/disputes.module';
import { SupportModule } from './support/support.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { WeighingSlipsModule } from './weighing-slips/weighing-slips.module';
import { TrackingModule } from './tracking/tracking.module';
import { GuestOrdersModule } from './guest-orders/guest-orders.module';
import { PayoutsModule } from './payouts/payouts.module';
import { VehicleAssignmentsModule } from './vehicle-assignments/vehicle-assignments.module';
import { CmsModule } from './cms/cms.module';
import { JumisModule } from './jumis/jumis.module';
import { BisModule } from './bis/bis.module';
import { LursoftModule } from './lursoft/lursoft.module';
import { SupplierLoadingSlotsModule } from './supplier-loading-slots/supplier-loading-slots.module';
import { FuelModule } from './fuel/fuel.module';
import { SupplierLocationsModule } from './supplier-locations/supplier-locations.module';
import { CatalogueModule } from './catalogue/catalogue.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ScheduleModule.forRoot(),
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
    ToiletCabinsModule,
    DocumentsModule,
    ProviderApplicationsModule,
    VehiclesModule,
    TransportJobsModule,
    NotificationsModule,
    InvoicesModule,
    CompanyModule,
    CarrierSettingsModule,
    DriverScheduleModule,
    SupplierLoadingSlotsModule,
    AdminModule,
    ReviewsModule,
    ChatModule,
    ContainersModule,
    RecyclingCentersModule,
    EmailModule,
    FrameworkContractsModule,
    CompanyMembersModule,
    MapsModule,
    PaymentsModule,
    AnalyticsModule,
    UpdatesModule,
    HealthModule,
    SavedAddressesModule,
    PaymentMethodsModule,
    DisputesModule,
    SupportModule,
    ApiKeysModule,
    WeighingSlipsModule,
    TrackingModule,
    GuestOrdersModule,
    PayoutsModule,
    VehicleAssignmentsModule,
    CmsModule,
    JumisModule,
    BisModule,
    LursoftModule,
    FuelModule,
    SupplierLocationsModule,
    CatalogueModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Sentry global filter — must be first so it captures all unhandled errors
    { provide: APP_FILTER, useClass: SentryGlobalFilter },
    // Apply throttle guard globally — logs violations, individual endpoints can override with @Throttle()
    { provide: APP_GUARD, useClass: LoggingThrottlerGuard },
  ],
})
export class AppModule {}
