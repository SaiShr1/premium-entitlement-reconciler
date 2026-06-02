import { Module } from '@nestjs/common';
import { StoreWebhookController } from './store-webhook.controller';
import { StoreWebhookService } from './store-webhook.service';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

@Module({
  controllers: [StoreWebhookController, MarketplaceController],
  providers: [StoreWebhookService, MarketplaceService],
})
export class WebhooksModule {}