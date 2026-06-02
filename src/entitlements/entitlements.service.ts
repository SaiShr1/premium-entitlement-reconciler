import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class EntitlementsService {
  constructor(private readonly db: DatabaseService) {}

  async getByUserId(userId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM entitlements WHERE user_id = $1`,
      [userId],
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      active: row.active,
      source: row.source,
      expiresAt: row.expires_at,
      lastChangedAt: row.last_changed_at,
      reason: row.reason,
    };
  }
}