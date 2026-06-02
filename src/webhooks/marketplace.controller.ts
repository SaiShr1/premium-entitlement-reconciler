import { Controller, Post, Body } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceRevokeDto } from './dto/marketplace-revoke.dto';

@Controller('webhooks/marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post('revoke')
  async bulkRevoke(@Body() dto: MarketplaceRevokeDto) {
    return this.marketplaceService.bulkRevoke(dto.userIds);
  }
}