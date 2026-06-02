import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

@Controller('users')
export class EntitlementsController {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Get(':id/entitlement')
  async getEntitlement(@Param('id') id: string) {
    const result = await this.entitlementsService.getByUserId(id);
    if (!result) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return result;
  }
}