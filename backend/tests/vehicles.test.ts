import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import { initializeDatabase } from '../src/database.js';
import { authResult } from '../src/auth/service.js';
import { testDatabase } from './database.js';

const vehicle = { make: 'Volvo', model: 'XC60', category: 'SUV', price: 4890000, quantity: 3 };
const secret = 'test-only-secret-with-at-least-32-characters';

describe('vehicle inventory', () => {
  let database: Awaited<ReturnType<typeof testDatabase>>;
  let app: ReturnType<typeof createApp>;
  let userToken: string;
  let adminToken: string;
  beforeAll(async () => {
    database = await testDatabase();
    await initializeDatabase(database.db);
    app = createApp(database.db, secret);
    for (const role of ['user', 'admin'] as const) {
      const user = { _id: new ObjectId(), email: `${role}@example.com`, role, passwordHash: 'unused-fixture' };
      await database.db.collection('users').insertOne(user);
      const token = authResult(user, secret).token;
      if (role === 'user') userToken = token;
      else adminToken = token;
    }
  });
  beforeEach(async () => { await database.db.collection('vehicles').deleteMany({}); });
  afterAll(async () => { await database?.close(); });

  const create = (input = vehicle, token = userToken) =>
    request(app).post('/api/vehicles').auth(token, { type: 'bearer' }).send(input);

  it('allows an authenticated regular user to create a persistent vehicle', async () => {
    const response = await create();
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ...vehicle, id: expect.any(String) });
    expect(await database.db.collection('vehicles').countDocuments()).toBe(1);
  });

  it('lists vehicles including zero-stock vehicles', async () => {
    await create();
    await create({ ...vehicle, model: 'S60', quantity: 0 });
    const response = await request(app).get('/api/vehicles').auth(userToken, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expect(response.body.find((item: typeof vehicle) => item.model === 'S60').quantity).toBe(0);
  });

  it('returns an empty array for an empty inventory', async () => {
    const response = await request(app).get('/api/vehicles').auth(userToken, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each([
    {}, { ...vehicle, make: ' ' }, { ...vehicle, model: '' }, { ...vehicle, category: '' },
    { ...vehicle, price: -1 }, { ...vehicle, price: 1.5 }, { ...vehicle, price: '100' },
    { ...vehicle, quantity: -1 }, { ...vehicle, quantity: 0.5 }, { ...vehicle, quantity: '1' },
    { ...vehicle, quantity: Number.MAX_SAFE_INTEGER + 1 }, { ...vehicle, price: Number.MAX_SAFE_INTEGER + 1 },
    { ...vehicle, unexpected: true }
  ])('rejects invalid vehicle input %#', async input => {
    expect((await request(app).post('/api/vehicles').auth(userToken, { type: 'bearer' }).send(input)).status).toBe(400);
    expect(await database.db.collection('vehicles').countDocuments()).toBe(0);
  });
});
