import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NotificationScheduler {
  constructor(private readonly db: DatabaseService) {}

  async schedule(userId: string, expiresAt: Date) {
      const scheduledFor = new Date(expiresAt.getTime() - 24 * 60 * 60 * 1000);
    await this.db.query(
      `INSERT INTO notifications (user_id, type, scheduled_for)
       VALUES ($1, 'PREMIUM_EXPIRES_SOON', $2)
       ON CONFLICT ON CONSTRAINT uq_notifications_once DO NOTHING`,
      [userId, scheduledFor],
    );
  }
}