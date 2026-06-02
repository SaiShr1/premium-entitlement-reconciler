import { Module } from '@nestjs/common';
import { MockCarrierService } from './mock-carrier.service';
import { MockCarrierController } from './mock-carrier.controller';

@Module({
  providers: [MockCarrierService],
  controllers: [MockCarrierController]
})
export class CarrierModule {}
