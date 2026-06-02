import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(private readonly db: DatabaseService) {}

  @Cron('* * * * *')
  async processNotifications() {
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT id, user_id, type, scheduled_for FROM notifications
         WHERE scheduled_for <= NOW() AND sent_at IS NULL
         LIMIT 10
         FOR UPDATE SKIP LOCKED`,
      );

      if (rows.length === 0) {
        await client.query('COMMIT');
        return;
      }

      for (const row of rows) {
        this.logger.log(
          `Sending ${row.type} notification to user ${row.user_id}`,
        );
        await client.query(
          `UPDATE notifications SET sent_at = NOW() WHERE id = $1`,
          [row.id],
        );
      }

      await client.query('COMMIT');
      this.logger.log(`Processed ${rows.length} notifications`);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error('Notification worker failed', err);
      throw err;
    } finally {
      client.release();
    }
  }
}