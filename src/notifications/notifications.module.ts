import { Module } from '@nestjs/common';
import { NotificationScheduler } from './notification-scheduler.service';
import { NotificationWorker } from './notification-worker.service';

@Module({
  providers: [NotificationScheduler, NotificationWorker],
  exports: [NotificationScheduler],
})
export class NotificationsModule {}