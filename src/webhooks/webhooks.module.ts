import { Module } from '@nestjs/common';
import { StoreWebhookController } from './store-webhook.controller';
import { StoreWebhookService } from './store-webhook.service';

@Module({
  controllers: [StoreWebhookController],
  providers: [StoreWebhookService],
})
export class WebhooksModule {}