import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { createApp } from '../src/app.js';
import { testDatabase } from './database.js';
import { initializeDatabase } from '../src/database.js';

describe('registration', () => {
  let database: Awaited<ReturnType<typeof testDatabase>>;
  let app: ReturnType<typeof createApp>;
  beforeAll(async () => {
    database = await testDatabase();
    await initializeDatabase(database.db);
    app = createApp(database.db, 'test-only-secret-with-at-least-32-characters');
  });
  afterAll(async () => { await database?.close(); });

  it('registers a regular user and persists a hash without returning it', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: '  DRIVER@example.com ', password: 'correct-horse-42', role: 'admin'
    });
    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({
      id: expect.any(String), email: 'driver@example.com', role: 'user'
    });
    expect(response.body.token).toEqual(expect.any(String));
    expect(JSON.stringify(response.body)).not.toContain('password');
    const stored = await database.db.collection('users').findOne({ email: 'driver@example.com' });
    expect(stored?.passwordHash).not.toBe('correct-horse-42');
    expect(await bcrypt.compare('correct-horse-42', stored!.passwordHash)).toBe(true);
    expect(stored?.role).toBe('user');
  });

  it('rejects duplicate normalized email addresses, including racing registrations', async () => {
    const attempts = await Promise.all([
      request(app).post('/api/auth/register').send({ email: 'same@example.com', password: 'correct-horse-42' }),
      request(app).post('/api/auth/register').send({ email: ' SAME@EXAMPLE.COM ', password: 'different-pass-42' })
    ]);
    expect(attempts.map(result => result.status).sort()).toEqual([201, 409]);
    expect(await database.db.collection('users').countDocuments({ email: 'same@example.com' })).toBe(1);
  });

  it.each([
    {}, { email: 'not-an-email', password: 'correct-horse-42' },
    { email: 'short@example.com', password: 'short' },
    { email: 'long@example.com', password: 'x'.repeat(73) },
    { email: 'unicode@example.com', password: '界'.repeat(25) }
  ])('rejects invalid credentials %j', async input => {
    expect((await request(app).post('/api/auth/register').send(input)).status).toBe(400);
  });

  it('logs in with a normalized email and returns only public user fields', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'DRIVER@example.com', password: 'correct-horse-42'
    });
    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('driver@example.com');
    expect(response.body.user.role).toBe('user');
    expect(JSON.stringify(response.body)).not.toContain('password');
    const claims = jwt.verify(response.body.token, 'test-only-secret-with-at-least-32-characters');
    expect(claims).toMatchObject({ sub: response.body.user.id });
  });

  it.each([
    { email: 'driver@example.com', password: 'wrong-password' },
    { email: 'missing@example.com', password: 'correct-horse-42' }
  ])('rejects bad login without disclosing whether email exists', async input => {
    const response = await request(app).post('/api/auth/login').send(input);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Email or password is incorrect' });
  });

  it('rejects malformed login inputs', async () => {
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
  });

  it.each([
    undefined,
    'Bearer nonsense',
    'Basic abc',
    `Bearer ${jwt.sign({}, 'test-only-secret-with-at-least-32-characters', {
      subject: new ObjectId().toHexString(), expiresIn: -1,
      issuer: 'car-dealership', audience: 'car-dealership-ui'
    })}`,
    `Bearer ${jwt.sign({}, 'different-secret', { subject: new ObjectId().toHexString() })}`,
    `Bearer ${jwt.sign({}, 'test-only-secret-with-at-least-32-characters', {
      subject: 'not-an-id', issuer: 'car-dealership', audience: 'car-dealership-ui'
    })}`,
    `Bearer ${jwt.sign({}, 'test-only-secret-with-at-least-32-characters', {
      subject: new ObjectId().toHexString(), issuer: 'car-dealership', audience: 'car-dealership-ui'
    })}`
  ])('requires a valid unexpired token for every vehicle route (case %#)', async token => {
    const routes = [
      ['get', '/api/vehicles'], ['post', '/api/vehicles'], ['get', '/api/vehicles/search'],
      ['put', '/api/vehicles/123'], ['delete', '/api/vehicles/123'],
      ['post', '/api/vehicles/123/purchase'], ['post', '/api/vehicles/123/restock']
    ] as const;
    for (const [method, route] of routes) {
      const call = request(app)[method](route);
      if (token) call.set('Authorization', token);
      expect((await call).status, `${method} ${route}`).toBe(401);
    }
  });
});
