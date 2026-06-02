import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { DatabaseService } from './database/database.service';
import { WebhooksModule } from './webhooks/webhooks.module';
import { EntitlementsService } from './entitlements/entitlements.service';
import { EntitlementsController } from './entitlements/entitlements.controller';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { CarrierModule } from './carrier/carrier.module';
import { MockCarrierService } from './carrier/mock-carrier.service';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    WebhooksModule,
    EntitlementsModule,
    CarrierModule
  ],
  controllers: [HealthController, EntitlementsController],
  providers: [DatabaseService, EntitlementsService, MockCarrierService],
})
export class AppModule {}