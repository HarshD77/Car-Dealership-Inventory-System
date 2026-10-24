import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/config.js';

describe('server configuration', () => {
  const valid = {
    MONGODB_URI: 'mongodb://127.0.0.1:27017/car_dealership',
    JWT_SECRET: 'a'.repeat(48),
  };
  it('reads the connection and secret, and defaults the port', () => {
    expect(readConfig(valid)).toEqual({
      mongoUri: valid.MONGODB_URI,
      jwtSecret: valid.JWT_SECRET,
      port: 3000,
    });
    expect(readConfig({ ...valid, PORT: '3100' }).port).toBe(3100);
  });
  it.each([
    {},
    { ...valid, JWT_SECRET: 'short' },
    { ...valid, JWT_SECRET: 'replace-with-a-random-secret-at-least-32-characters' },
    { ...valid, MONGODB_URI: 'http://example.com' },
    { ...valid, MONGODB_URI: 'mongodb://127.0.0.1:27017' },
    { ...valid, PORT: '0' },
    { ...valid, PORT: '65536' },
    { ...valid, PORT: 'abc' },
  ])('rejects unsafe or incomplete configuration %#', (env) => {
    expect(() => readConfig(env)).toThrow();
  });
});
