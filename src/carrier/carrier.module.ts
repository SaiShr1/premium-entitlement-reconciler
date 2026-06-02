import { Module } from '@nestjs/common';
import { MockCarrierService } from './mock-carrier.service';
import { MockCarrierController } from './mock-carrier.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [MockCarrierService],
  controllers: [MockCarrierController]
})
export class CarrierModule {}
