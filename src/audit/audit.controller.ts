import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('users')
export class AuditController {
  constructor(private readonly db: DatabaseService) {}

  @Get(':id/timeline')
  async getTimeline(@Param('id') id: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM entitlement_audit_log WHERE user_id = $1 ORDER BY changed_at ASC`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`No timeline found for user ${id}`);
    }

    return rows.map((row) => ({
      changedAt: row.changed_at,
      triggeringEventId: row.triggering_event_id,
      prevState: {
        active: row.prev_active,
        source: row.prev_source,
        expiresAt: row.prev_expires_at,
      },
      nextState: {
        active: row.next_active,
        source: row.next_source,
        expiresAt: row.next_expires_at,
      },
      reason: row.reason,
    }));
  }
}