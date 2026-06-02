import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';

export interface AuditEntry {
  userId: string;
  triggeringEventId?: string;
  prev: { active: boolean; source: string; expiresAt: Date | null };
  next: { active: boolean; source: string; expiresAt: Date | null };
  reason: string;
}

@Injectable()
export class AuditService {
  async record(client: PoolClient, entry: AuditEntry): Promise<void> {
    await client.query(
      `INSERT INTO entitlement_audit_log
         (user_id, triggering_event_id, prev_active, prev_source, prev_expires_at,
          next_active, next_source, next_expires_at, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        entry.userId,
        entry.triggeringEventId || null,
        entry.prev.active,
        entry.prev.source,
        entry.prev.expiresAt,
        entry.next.active,
        entry.next.source,
        entry.next.expiresAt,
        entry.reason,
      ],
    );
  }
}