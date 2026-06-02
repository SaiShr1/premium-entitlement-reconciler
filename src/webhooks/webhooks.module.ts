import { Module } from '@nestjs/common';
import { StoreWebhookController } from './store-webhook.controller';
import { StoreWebhookService } from './store-webhook.service';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { NotificationsModule } from '../notifications/notifications.module'
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [NotificationsModule, AuditModule],
  controllers: [StoreWebhookController, MarketplaceController],
  providers: [StoreWebhookService, MarketplaceService],
})
export class WebhooksModule {}