import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { createTestApp, resetDb, seedUser } from '../../../test/utils/test-utils';

describe('Store Webhook (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDb(db);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should process INITIAL_PURCHASE for new user', async () => {
    const res = await request(app.getHttpServer())
      .post('/webhooks/store')
      .send({
        eventId: 'evt_1',
        userId: 'u_test',
        type: 'INITIAL_PURCHASE',
        eventTimeMs: 1000,
        productId: 'premium_monthly',
      })
      .expect(201);

    expect(res.body.status).toBe('applied');
    expect(res.body.update.active).toBe(true);
    expect(res.body.update.source).toBe('STORE');
  });

  it('should reject duplicate eventId', async () => {
    const payload = {
      eventId: 'evt_dup',
      userId: 'u_test',
      type: 'INITIAL_PURCHASE',
      eventTimeMs: 1000,
      productId: 'premium_monthly',
    };

    await request(app.getHttpServer())
      .post('/webhooks/store')
      .send(payload)
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/webhooks/store')
      .send(payload)
      .expect(201);

    expect(res.body.status).toBe('duplicate');
  });

  it('should reject out-of-order event (lower timestamp)', async () => {
    await seedUser(db, 'u_test', {
      active: true,
      source: 'STORE',
      last_event_time_ms: 5000,
    });

    const res = await request(app.getHttpServer())
      .post('/webhooks/store')
      .send({
        eventId: 'evt_old',
        userId: 'u_test',
        type: 'RENEWAL',
        eventTimeMs: 3000,
        productId: 'premium_monthly',
      })
      .expect(201);

    expect(res.body.status).toBe('out_of_order');
  });

  it('should reject INITIAL_PURCHASE on CARRIER-owned user (first-write-wins)', async () => {
    await seedUser(db, 'u_carrier', {
      active: true,
      source: 'CARRIER',
    });

    const res = await request(app.getHttpServer())
      .post('/webhooks/store')
      .send({
        eventId: 'evt_conflict',
        userId: 'u_carrier',
        type: 'INITIAL_PURCHASE',
        eventTimeMs: 1000,
        productId: 'premium_monthly',
      })
      .expect(201);

    expect(res.body.status).toBe('source_conflict');
  });

  it('should set active=false on BILLING_ISSUE', async () => {
    await seedUser(db, 'u_test', {
      active: true,
      source: 'STORE',
      last_event_time_ms: 1000,
    });

    const res = await request(app.getHttpServer())
      .post('/webhooks/store')
      .send({
        eventId: 'evt_billing',
        userId: 'u_test',
        type: 'BILLING_ISSUE',
        eventTimeMs: 2000,
        productId: 'premium_monthly',
      })
      .expect(201);

    expect(res.body.status).toBe('applied');
    expect(res.body.update.active).toBe(false);
    expect(res.body.update.source).toBe('NONE');
    expect(res.body.update.reason).toBe('BILLING_ISSUE');
  });

  it('should set active=false on EXPIRATION', async () => {
    await seedUser(db, 'u_test', {
      active: true,
      source: 'STORE',
      last_event_time_ms: 1000,
    });

    const res = await request(app.getHttpServer())
      .post('/webhooks/store')
      .send({
        eventId: 'evt_expire',
        userId: 'u_test',
        type: 'EXPIRATION',
        eventTimeMs: 2000,
        productId: 'premium_monthly',
      })
      .expect(201);

    expect(res.body.status).toBe('applied');
    expect(res.body.update.active).toBe(false);
    expect(res.body.update.source).toBe('NONE');
  });

  it('should handle CANCELLATION without changing active status', async () => {
    await seedUser(db, 'u_test', {
      active: true,
      source: 'STORE',
      last_event_time_ms: 1000,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const res = await request(app.getHttpServer())
      .post('/webhooks/store')
      .send({
        eventId: 'evt_cancel',
        userId: 'u_test',
        type: 'CANCELLATION',
        eventTimeMs: 2000,
        productId: 'premium_monthly',
      })
      .expect(201);

    expect(res.body.status).toBe('applied');
    expect(res.body.update.active).toBe(true);
    expect(res.body.update.reason).toBe('CANCELLATION');
  });
});