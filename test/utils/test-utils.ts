import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DatabaseService } from '../../src/database/database.service';

export async function createTestApp(): Promise<{
  app: INestApplication;
  db: DatabaseService;
}> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const db = app.get(DatabaseService);
  return { app, db };
}

export async function resetDb(db: DatabaseService) {
  await db.query('DELETE FROM notifications');
  await db.query('DELETE FROM processed_events');
  await db.query('DELETE FROM entitlements');
}

export async function seedUser(
  db: DatabaseService,
  userId: string,
  overrides: Record<string, any> = {},
) {
  const defaults = {
    active: false,
    source: 'NONE',
    expires_at: null,
    reason: null,
    last_event_time_ms: null,
  };
  const vals = { ...defaults, ...overrides };

  await db.query(
    `INSERT INTO entitlements (user_id, active, source, expires_at, reason, last_event_time_ms)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       active = $2, source = $3, expires_at = $4, reason = $5, last_event_time_ms = $6`,
    [userId, vals.active, vals.source, vals.expires_at, vals.reason, vals.last_event_time_ms],
  );
}