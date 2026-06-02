import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MockCarrierService {
  private readonly logger = new Logger(MockCarrierService.name);
  private readonly carrierBaseUrl =
    process.env.CARRIER_API_URL || 'http://localhost:3000';

  constructor(private readonly db: DatabaseService) {}

  @Cron('*/5 * * * *')
  async pollCarrier() {
    this.logger.log('Carrier poll started');
    const client = await this.db.getClient();

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT user_id, expires_at FROM entitlements
         WHERE source = 'CARRIER' AND active = true
         LIMIT 10
         FOR UPDATE SKIP LOCKED`,
      );

      if (rows.length === 0) {
        await client.query('COMMIT');
        this.logger.log('No carrier users to poll');
        return;
      }

      for (const row of rows) {
        const status = await this.fetchCarrierStatus(row.user_id);
        this.logger.log(`User ${row.user_id}: carrier status=${status}`);

        if (status === 'active') {
          await client.query(
            `UPDATE entitlements SET last_changed_at = NOW() WHERE user_id = $1`,
            [row.user_id],
          );
        } else if (status === 'inactive') {
          await client.query(
            `UPDATE entitlements
             SET active = false, source = 'NONE', reason = 'CARRIER_INACTIVE', last_changed_at = NOW()
             WHERE user_id = $1`,
            [row.user_id],
          );
        }
        // api_error → no-op (fail safe)
      }

      await client.query('COMMIT');
      this.logger.log('Carrier poll complete');
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error('Carrier poll failed', err);
      throw err;
    } finally {
      client.release();
    }
  }

  private async fetchCarrierStatus(userId: string): Promise<string> {
    try {
      const res = await fetch(
        `${this.carrierBaseUrl}/mock/carrier/plan?userId=${userId}`,
      );
      const data = await res.json();
      return data.status;
    } catch {
      this.logger.warn(`Carrier API call failed for ${userId}`);
      return 'api_error';
    }
  }
}