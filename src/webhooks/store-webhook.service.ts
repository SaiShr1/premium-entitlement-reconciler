import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationScheduler } from '../notifications/notification-scheduler.service';
import { StoreWebhookDto } from './dto/store-webhook.dto';

@Injectable()
export class StoreWebhookService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notificationScheduler: NotificationScheduler
  ) { }

  async process(dto: StoreWebhookDto) {
    // 1. Idempotency check
    const { rowCount } = await this.db.query(
      `INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [dto.eventId],
    );
    if (rowCount === 0) {
      return { status: 'duplicate', eventId: dto.eventId };
    }

    // 2. Lock the entitlement row
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT * FROM entitlements WHERE user_id = $1 FOR UPDATE`,
        [dto.userId],
      );

      // If user doesn't exist, create a blank row
      let row = rows[0];
      if (!row) {
        await client.query(
          `INSERT INTO entitlements (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
          [dto.userId],
        );
        const res = await client.query(
          `SELECT * FROM entitlements WHERE user_id = $1 FOR UPDATE`,
          [dto.userId],
        );
        row = res.rows[0];
      }

      // 3. Source conflict — first-write-wins
      if (row.active && row.source !== 'STORE' && row.source !== 'NONE') {
        await client.query('COMMIT');
        return { status: 'source_conflict', current: this.mapRow(row) };
      }

      // 4. Out-of-order guard
      if (row.last_event_time_ms && dto.eventTimeMs <= Number(row.last_event_time_ms)) {
        await client.query('COMMIT');
        return { status: 'out_of_order', current: this.mapRow(row) };
      }

      // 5. Apply state machine
      const update = this.applyStateMachine(dto, row);
      if (!update) {
        await client.query('COMMIT');
        return { status: 'no_op', current: this.mapRow(row) };
      }

      // 6. Write update
      await client.query(
        `UPDATE entitlements
         SET active = $1, source = $2, expires_at = $3,
             reason = $4, last_event_time_ms = $5, last_changed_at = NOW()
         WHERE user_id = $6`,
        [
          update.active,
          update.source,
          update.expiresAt,
          update.reason,
          dto.eventTimeMs,
          dto.userId,
        ],
      );

      await client.query('COMMIT');

      // Schedule notification if expiring within 24h
      if (update.expiresAt) {
        const hoursUntilExpiry =
          (new Date(update.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntilExpiry <= 24 && hoursUntilExpiry > 0) {
          await this.notificationScheduler.schedule(dto.userId, new Date(update.expiresAt));
        }
      }

      return { status: 'applied', update };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  private applyStateMachine(dto: StoreWebhookDto, row: any) {
    const expiresAt = this.computeExpiry(dto.productId);

    switch (dto.type) {
      case 'INITIAL_PURCHASE':
        return {
          active: true,
          source: 'STORE',
          expiresAt,
          reason: 'INITIAL_PURCHASE',
        };

      case 'RENEWAL':
        if (row.source !== 'STORE') return null;
        return {
          active: true,
          source: 'STORE',
          expiresAt: this.extendExpiry(row.expires_at, dto.productId),
          reason: 'RENEWAL',
        };

      case 'CANCELLATION':
        if (row.source !== 'STORE') return null;
        return {
          active: row.active,
          source: row.source,
          expiresAt: row.expires_at,
          reason: 'CANCELLATION',
        };

      case 'UN_CANCELLATION':
        if (row.source !== 'STORE') return null;
        return {
          active: row.active,
          source: row.source,
          expiresAt: row.expires_at,
          reason: 'UN_CANCELLATION',
        };

      case 'BILLING_ISSUE':
        if (row.source !== 'STORE') return null;
        return {
          active: false,
          source: 'NONE',
          expiresAt: null,
          reason: 'BILLING_ISSUE',
        };

      case 'EXPIRATION':
        if (row.source !== 'STORE') return null;
        return {
          active: false,
          source: 'NONE',
          expiresAt: null,
          reason: 'EXPIRATION',
        };

      default:
        return null;
    }
  }

  private computeExpiry(productId: string): Date {
    const now = new Date();
    if (productId === 'premium_annual') {
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    }
    // Default: 30 days (covers premium_monthly and unknown)
    return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  private extendExpiry(currentExpiry: Date | null, productId: string): Date {
    const base = currentExpiry ? new Date(currentExpiry) : new Date();
    if (productId === 'premium_annual') {
      return new Date(base.getTime() + 365 * 24 * 60 * 60 * 1000);
    }
    return new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  private mapRow(row: any) {
    return {
      active: row.active,
      source: row.source,
      expiresAt: row.expires_at,
      lastChangedAt: row.last_changed_at,
      reason: row.reason,
    };
  }
}