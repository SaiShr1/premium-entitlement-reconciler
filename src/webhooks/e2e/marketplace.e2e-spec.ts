import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { createTestApp, resetDb, seedUser } from '../../../test/utils/test-utils';

describe('Marketplace Revoke (e2e)', () => {
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

  it('should revoke MARKETPLACE user', async () => {
    await seedUser(db, 'u_market', {
      active: true,
      source: 'MARKETPLACE',
    });

    const res = await request(app.getHttpServer())
      .post('/webhooks/marketplace/revoke')
      .send({ userIds: ['u_market'] })
      .expect(201);

    expect(res.body.revokedCount).toBe(1);
    expect(res.body.revokedUserIds).toContain('u_market');
  });

  it('should NOT revoke STORE user (source guard)', async () => {
    await seedUser(db, 'u_store', {
      active: true,
      source: 'STORE',
    });

    const res = await request(app.getHttpServer())
      .post('/webhooks/marketplace/revoke')
      .send({ userIds: ['u_store'] })
      .expect(201);

    expect(res.body.revokedCount).toBe(0);
  });

  it('should handle bulk revoke with mixed users', async () => {
    await seedUser(db, 'u_m1', { active: true, source: 'MARKETPLACE' });
    await seedUser(db, 'u_m2', { active: true, source: 'MARKETPLACE' });
    await seedUser(db, 'u_s1', { active: true, source: 'STORE' });

    const res = await request(app.getHttpServer())
      .post('/webhooks/marketplace/revoke')
      .send({ userIds: ['u_m1', 'u_m2', 'u_s1'] })
      .expect(201);

    expect(res.body.revokedCount).toBe(2);
  });
});