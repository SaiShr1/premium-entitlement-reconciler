import { Controller, Get, Query } from '@nestjs/common';

@Controller('mock/carrier')
export class MockCarrierController {
  @Get('plan')
  getPlan(@Query('userId') userId: string) {
    const rand = Math.random();
    let status: string;

    if (rand < 0.85) {
      status = 'active';
    } else if (rand < 0.95) {
      status = 'inactive';
    } else {
      status = 'api_error';
    }

    return { userId, status };
  }
}