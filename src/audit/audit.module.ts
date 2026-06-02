import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

@Module({
  providers: [AuditService],
  exports: [AuditService],
  controllers: [AuditController],
})
export class AuditModule {}