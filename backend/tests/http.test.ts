import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDatabase } from '../src/database.js';
import { testDatabase } from './database.js';

describe('HTTP errors and persistent connection lifecycle', () => {
  let database: Awaited<ReturnType<typeof testDatabase>>;
  beforeAll(async () => {
    database = await testDatabase();
  });
  afterAll(async () => {
    await database?.close();
  });
  const secret = 'test-only-secret-with-at-least-32-characters';

  it('preserves users across closing connections and recreating the application', async () => {
    const first = await connectDatabase(database.uri);
    const original = await request(createApp(first.db, secret))
      .post('/api/auth/register')
      .send({ email: 'persistent@example.com', password: 'persistent-pass-42' });
    expect(original.status).toBe(201);
    await first.client.close();
    const second = await connectDatabase(database.uri);
    try {
      const login = await request(createApp(second.db, secret))
        .post('/api/auth/login')
        .send({ email: 'persistent@example.com', password: 'persistent-pass-42' });
      expect(login.status).toBe(200);
      expect(login.body.user.id).toBe(original.body.user.id);
    } finally {
      await second.client.close();
    }
  });

  it('returns JSON errors for malformed JSON and oversized requests', async () => {
    const app = createApp(database.db, secret);
    const malformed = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{broken');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ error: 'Invalid JSON body' });
    const oversized = await request(app)
      .post('/api/auth/login')
      .send({ data: 'x'.repeat(17000) });
    expect(oversized.status).toBe(413);
  });

  it('returns JSON for unknown API routes', async () => {
    const response = await request(createApp(database.db, secret)).get('/api/missing');
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Route not found' });
  });

  it('does not disclose database errors to the client', async () => {
    const connected = await connectDatabase(database.uri);
    await connected.client.close();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await request(createApp(connected.db, secret))
        .post('/api/auth/login')
        .send({ email: 'driver@example.com', password: 'correct-horse-42' });
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'An unexpected error occurred' });
    } finally {
      log.mockRestore();
    }
  });
});
