import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MarketplaceService {
  constructor(private readonly db: DatabaseService) {}

  async bulkRevoke(userIds: string[]) {
    const { rows } = await this.db.query(
      `UPDATE entitlements
       SET active = false,
           source = 'NONE',
           reason = 'MARKETPLACE_REVOKE',
           last_changed_at = NOW()
       WHERE user_id = ANY($1)
         AND source = 'MARKETPLACE'
       RETURNING user_id`,
      [userIds],
    );

    return { revokedCount: rows.length, revokedUserIds: rows.map(r => r.user_id) };
  }
}