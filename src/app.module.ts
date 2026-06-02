import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { DatabaseService } from './database/database.service';
import { WebhooksModule } from './webhooks/webhooks.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    WebhooksModule
  ],
  controllers: [HealthController],
  providers: [DatabaseService],
})
export class AppModule {}