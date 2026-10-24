import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { testDatabase } from './database.js';

describe('registration', () => {
  let database: Awaited<ReturnType<typeof testDatabase>>;
  let app: ReturnType<typeof createApp>;
  beforeAll(async () => {
    database = await testDatabase();
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
});
