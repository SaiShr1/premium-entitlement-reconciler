import { INestApplication } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MockCarrierService } from './mock-carrier.service';
import { createTestApp, resetDb, seedUser } from '../../test/utils/test-utils';

describe('Carrier Poll (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let pollService: MockCarrierService;

  beforeAll(async () => {
    ({ app, db } = await createTestApp());
    pollService = app.get(MockCarrierService);
  });

  beforeEach(async () => {
    await resetDb(db);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should set active=false when carrier returns inactive', async () => {
    await seedUser(db, 'u_carrier_1', {
      active: true,
      source: 'CARRIER',
    });

    jest
      .spyOn(pollService as any, 'fetchCarrierStatus')
      .mockResolvedValue('inactive');

    await pollService.pollCarrier();

    jest.restoreAllMocks();

    const { rows } = await db.query(
      'SELECT * FROM entitlements WHERE user_id = $1',
      ['u_carrier_1'],
    );

    expect(rows[0].active).toBe(false);
    expect(rows[0].source).toBe('NONE');
    expect(rows[0].reason).toBe('CARRIER_INACTIVE');
  });

  it('should NOT change state on api_error (fail safe)', async () => {
    await seedUser(db, 'u_carrier_2', {
      active: true,
      source: 'CARRIER',
    });

    jest
      .spyOn(pollService as any, 'fetchCarrierStatus')
      .mockResolvedValue('api_error');

    await pollService.pollCarrier();

    jest.restoreAllMocks();

    const { rows } = await db.query(
      'SELECT * FROM entitlements WHERE user_id = $1',
      ['u_carrier_2'],
    );

    expect(rows[0].active).toBe(true);
    expect(rows[0].source).toBe('CARRIER');
  });

  it('should keep user active when carrier returns active', async () => {
    await seedUser(db, 'u_carrier_3', {
      active: true,
      source: 'CARRIER',
    });

    jest
      .spyOn(pollService as any, 'fetchCarrierStatus')
      .mockResolvedValue('active');

    await pollService.pollCarrier();

    jest.restoreAllMocks();

    const { rows } = await db.query(
      'SELECT * FROM entitlements WHERE user_id = $1',
      ['u_carrier_3'],
    );

    expect(rows[0].active).toBe(true);
    expect(rows[0].source).toBe('CARRIER');
  });
});