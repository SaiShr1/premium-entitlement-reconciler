import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { StoreWebhookService } from './store-webhook.service';
import { StoreWebhookDto } from './dto/store-webhook.dto';

@Controller('webhooks')
export class StoreWebhookController {
  constructor(private readonly storeWebhookService: StoreWebhookService) {}

  @Post('store')
  @HttpCode(201)
  async handleStoreWebhook(@Body() dto: StoreWebhookDto) {
    return this.storeWebhookService.process(dto);
  }
}