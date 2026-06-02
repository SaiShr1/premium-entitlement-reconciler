import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { WebhooksModule } from './webhooks/webhooks.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { CarrierModule } from './carrier/carrier.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuditModule } from './audit/audit.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    WebhooksModule,
    EntitlementsModule,
    CarrierModule,
    NotificationsModule,
    AuditModule
  ],
  controllers: [HealthController],
})
export class AppModule {}