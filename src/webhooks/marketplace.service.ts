import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class MarketplaceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async bulkRevoke(userIds: string[]) {
    const client = await this.db.getClient();
    try {
      await client.query('BEGIN');

      // Get current state before revoking (for audit)
      const { rows: before } = await client.query(
        `SELECT * FROM entitlements
         WHERE user_id = ANY($1) AND source = 'MARKETPLACE'
         FOR UPDATE`,
        [userIds],
      );

      const { rows: revoked } = await client.query(
        `UPDATE entitlements
         SET active = false, source = 'NONE', reason = 'MARKETPLACE_REVOKE', last_changed_at = NOW()
         WHERE user_id = ANY($1) AND source = 'MARKETPLACE'
         RETURNING user_id`,
        [userIds],
      );

      // Audit each revocation
      for (const prev of before) {
        await this.auditService.record(client, {
          userId: prev.user_id,
          prev: {
            active: prev.active,
            source: prev.source,
            expiresAt: prev.expires_at,
          },
          next: {
            active: false,
            source: 'NONE',
            expiresAt: prev.expires_at,
          },
          reason: 'MARKETPLACE_REVOKE',
        });
      }

      await client.query('COMMIT');
      return { revokedCount: revoked.length, revokedUserIds: revoked.map(r => r.user_id) };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}