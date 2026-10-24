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
      const user = {
        _id: new ObjectId(),
        email: `${role}@example.com`,
        role,
        passwordHash: 'unused-fixture',
      };
      await database.db.collection('users').insertOne(user);
      const token = authResult(user, secret).token;
      if (role === 'user') userToken = token;
      else adminToken = token;
    }
  });
  beforeEach(async () => {
    await database.db.collection('vehicles').deleteMany({});
  });
  afterAll(async () => {
    await database?.close();
  });

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
    {},
    { ...vehicle, make: ' ' },
    { ...vehicle, model: '' },
    { ...vehicle, category: '' },
    { ...vehicle, price: -1 },
    { ...vehicle, price: 1.5 },
    { ...vehicle, price: '100' },
    { ...vehicle, quantity: -1 },
    { ...vehicle, quantity: 0.5 },
    { ...vehicle, quantity: '1' },
    { ...vehicle, quantity: Number.MAX_SAFE_INTEGER + 1 },
    { ...vehicle, price: Number.MAX_SAFE_INTEGER + 1 },
    { ...vehicle, unexpected: true },
  ])('rejects invalid vehicle input %#', async (input) => {
    expect(
      (await request(app).post('/api/vehicles').auth(userToken, { type: 'bearer' }).send(input))
        .status,
    ).toBe(400);
    expect(await database.db.collection('vehicles').countDocuments()).toBe(0);
  });

  it('combines case-insensitive text filters and inclusive price bounds', async () => {
    await create();
    await create({ ...vehicle, model: 'S60', category: 'Sedan', price: 3000000 });
    await create({ ...vehicle, make: 'Toyota', model: 'RAV4', price: 3500000 });
    const response = await request(app)
      .get('/api/vehicles/search')
      .query({ make: 'VOL', model: 'xc', category: 'su', minPrice: '4890000', maxPrice: '4890000' })
      .auth(userToken, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ ...vehicle, id: expect.any(String) }]);
  });

  it('supports individual filters, no filters, and no matches', async () => {
    await create();
    for (const query of [
      { make: 'Volvo' },
      { model: 'XC60' },
      { category: 'SUV' },
      { minPrice: '0' },
      { maxPrice: '5000000' },
      {},
    ]) {
      const response = await request(app)
        .get('/api/vehicles/search')
        .query(query)
        .auth(userToken, { type: 'bearer' });
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    }
    const response = await request(app)
      .get('/api/vehicles/search')
      .query({ make: 'missing' })
      .auth(userToken, { type: 'bearer' });
    expect(response.body).toEqual([]);
  });

  it('treats regex characters as literal search text', async () => {
    await create();
    await create({ ...vehicle, make: 'A+B' });
    const response = await request(app)
      .get('/api/vehicles/search')
      .query({ make: 'A+B' })
      .auth(userToken, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].make).toBe('A+B');
  });

  it.each([
    { minPrice: '-1' },
    { maxPrice: '1.5' },
    { minPrice: 'abc' },
    { minPrice: '20', maxPrice: '10' },
    { minPrice: '' },
    { minPrice: '9007199254740992' },
    { make: ['Volvo', 'Toyota'] },
    { unknown: 'x' },
  ])('rejects invalid search filters %#', async (query) => {
    expect(
      (
        await request(app)
          .get('/api/vehicles/search')
          .query(query)
          .auth(userToken, { type: 'bearer' })
      ).status,
    ).toBe(400);
  });

  it('allows regular users to replace vehicle details and keeps its ID', async () => {
    const original = await create();
    const updated = { ...vehicle, model: 'XC90', price: 6500000, quantity: 2 };
    const response = await request(app)
      .put(`/api/vehicles/${original.body.id}`)
      .auth(userToken, { type: 'bearer' })
      .send(updated);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...updated, id: original.body.id });
    const stored = await database.db
      .collection('vehicles')
      .findOne({ _id: new ObjectId(original.body.id) });
    expect(stored?.model).toBe('XC90');
  });

  it('rejects incomplete and invalid replacements without changing the vehicle', async () => {
    const original = await create();
    for (const input of [
      { model: 'XC90' },
      { ...vehicle, quantity: -2 },
      { ...vehicle, price: 1.1 },
    ]) {
      expect(
        (
          await request(app)
            .put(`/api/vehicles/${original.body.id}`)
            .auth(userToken, { type: 'bearer' })
            .send(input)
        ).status,
      ).toBe(400);
    }
    expect((await database.db.collection('vehicles').findOne())?.quantity).toBe(3);
  });

  it('allows admins to delete vehicles and forbids regular users', async () => {
    const original = await create();
    expect(
      (
        await request(app)
          .delete(`/api/vehicles/${original.body.id}`)
          .auth(userToken, { type: 'bearer' })
      ).status,
    ).toBe(403);
    expect(await database.db.collection('vehicles').countDocuments()).toBe(1);
    const response = await request(app)
      .delete(`/api/vehicles/${original.body.id}`)
      .auth(adminToken, { type: 'bearer' });
    expect(response.status).toBe(204);
    expect(await database.db.collection('vehicles').countDocuments()).toBe(0);
  });

  it('checks the stored role even if an old token belongs to a former admin', async () => {
    await database.db
      .collection('users')
      .updateOne({ email: 'admin@example.com' }, { $set: { role: 'user' } });
    try {
      expect(
        (
          await request(app)
            .delete(`/api/vehicles/${new ObjectId()}`)
            .auth(adminToken, { type: 'bearer' })
        ).status,
      ).toBe(403);
    } finally {
      await database.db
        .collection('users')
        .updateOne({ email: 'admin@example.com' }, { $set: { role: 'admin' } });
    }
  });

  it.each(['put', 'delete'] as const)(
    'handles invalid and nonexistent IDs on %s',
    async (method) => {
      for (const [id, status] of [
        ['invalid-id', 400],
        [new ObjectId().toHexString(), 404],
      ] as const) {
        const response = await request(app)
          [method](`/api/vehicles/${id}`)
          .auth(adminToken, { type: 'bearer' })
          .send(vehicle);
        expect(response.status).toBe(status);
        expect(response.body.error).toEqual(expect.any(String));
      }
    },
  );

  it('purchases exactly one unit and persists the new stock', async () => {
    const original = await create();
    const response = await request(app)
      .post(`/api/vehicles/${original.body.id}/purchase`)
      .auth(userToken, { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.quantity).toBe(2);
    expect((await database.db.collection('vehicles').findOne())?.quantity).toBe(2);
  });

  it('rejects purchases of sold-out vehicles without changing stock', async () => {
    const original = await create({ ...vehicle, quantity: 0 });
    const response = await request(app)
      .post(`/api/vehicles/${original.body.id}/purchase`)
      .auth(userToken, { type: 'bearer' });
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Vehicle is out of stock');
    expect((await database.db.collection('vehicles').findOne())?.quantity).toBe(0);
  });

  it('allows only one of twelve concurrent purchases of the last unit', async () => {
    const original = await create({ ...vehicle, quantity: 1 });
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        request(app)
          .post(`/api/vehicles/${original.body.id}/purchase`)
          .auth(userToken, { type: 'bearer' }),
      ),
    );
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(11);
    expect((await database.db.collection('vehicles').findOne())?.quantity).toBe(0);
  });

  it('rejects client-specified purchase quantities', async () => {
    const original = await create();
    const response = await request(app)
      .post(`/api/vehicles/${original.body.id}/purchase`)
      .auth(userToken, { type: 'bearer' })
      .send({ quantity: -1 });
    expect(response.status).toBe(400);
    expect((await database.db.collection('vehicles').findOne())?.quantity).toBe(3);
  });

  it('allows only admins to restock and adds quantities atomically', async () => {
    const original = await create({ ...vehicle, quantity: 0 });
    expect(
      (
        await request(app)
          .post(`/api/vehicles/${original.body.id}/restock`)
          .auth(userToken, { type: 'bearer' })
          .send({ quantity: 2 })
      ).status,
    ).toBe(403);
    const results = await Promise.all(
      [2, 3].map((quantity) =>
        request(app)
          .post(`/api/vehicles/${original.body.id}/restock`)
          .auth(adminToken, { type: 'bearer' })
          .send({ quantity }),
      ),
    );
    expect(results.every((result) => result.status === 200)).toBe(true);
    expect((await database.db.collection('vehicles').findOne())?.quantity).toBe(5);
  });

  it.each([
    {},
    { quantity: 0 },
    { quantity: -1 },
    { quantity: 1.1 },
    { quantity: '2' },
    { quantity: null },
    { quantity: Number.MAX_SAFE_INTEGER + 1 },
    { quantity: 1, extra: true },
  ])('rejects invalid restocking %#', async (input) => {
    const original = await create();
    expect(
      (
        await request(app)
          .post(`/api/vehicles/${original.body.id}/restock`)
          .auth(adminToken, { type: 'bearer' })
          .send(input)
      ).status,
    ).toBe(400);
    expect((await database.db.collection('vehicles').findOne())?.quantity).toBe(3);
  });

  it('prevents stock integer overflow', async () => {
    const original = await create({ ...vehicle, quantity: Number.MAX_SAFE_INTEGER });
    expect(
      (
        await request(app)
          .post(`/api/vehicles/${original.body.id}/restock`)
          .auth(adminToken, { type: 'bearer' })
          .send({ quantity: 1 })
      ).status,
    ).toBe(409);
    expect((await database.db.collection('vehicles').findOne())?.quantity).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it.each(['purchase', 'restock'])('handles invalid and missing IDs for %s', async (action) => {
    for (const [id, status] of [
      ['invalid', 400],
      [new ObjectId().toHexString(), 404],
    ] as const) {
      const response = await request(app)
        .post(`/api/vehicles/${id}/${action}`)
        .auth(adminToken, { type: 'bearer' })
        .send(action === 'restock' ? { quantity: 1 } : {});
      expect(response.status).toBe(status);
      expect(response.body.error).toEqual(expect.any(String));
    }
  });
});
