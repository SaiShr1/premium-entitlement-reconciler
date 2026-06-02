import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { NotificationWorker } from './notification-worker.service';
import { NotificationScheduler } from './notification-scheduler.service';
import { createTestApp, resetDb } from '../../test/utils/test-utils';

describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let worker: NotificationWorker;
  let scheduler: NotificationScheduler;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    worker = app.get(NotificationWorker);
    scheduler = app.get(NotificationScheduler);
  });

  beforeEach(async () => {
    await resetDb(db);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should schedule a notification for expiring entitlement', async () => {
    const expiresAt = new Date(Date.now() + 20 * 60 * 60 * 1000); // 20h from now
    await scheduler.schedule('u_test', expiresAt);

    const { rows } = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1',
      ['u_test'],
    );

    expect(rows.length).toBe(1);
    expect(rows[0].type).toBe('PREMIUM_EXPIRES_SOON');
    expect(rows[0].sent_at).toBeNull();
  });

  it('should not create duplicate notification (unique constraint)', async () => {
    const expiresAt = new Date(Date.now() + 20 * 60 * 60 * 1000);
    await scheduler.schedule('u_test', expiresAt);
    await scheduler.schedule('u_test', expiresAt);

    const { rows } = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1',
      ['u_test'],
    );

    expect(rows.length).toBe(1);
  });

  it('should process pending notification and set sent_at', async () => {
    await db.query(
      `INSERT INTO notifications (user_id, type, scheduled_for)
       VALUES ($1, 'PREMIUM_EXPIRES_SOON', NOW() - INTERVAL '1 minute')`,
      ['u_test_process'],
    );

    await worker.processNotifications();

    const { rows } = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1',
      ['u_test_process'],
    );

    expect(rows.length).toBe(1);
    expect(rows[0].sent_at).not.toBeNull();
  });

  it('should not re-send already sent notification', async () => {
    await db.query(
      `INSERT INTO notifications (user_id, type, scheduled_for, sent_at)
       VALUES ($1, 'PREMIUM_EXPIRES_SOON', NOW() - INTERVAL '1 hour', NOW())`,
      ['u_test'],
    );

    await worker.processNotifications();

    const { rows } = await db.query(
      'SELECT * FROM notifications WHERE user_id = $1',
      ['u_test'],
    );

    // Should still have only one row, sent_at unchanged
    expect(rows.length).toBe(1);
  });
});