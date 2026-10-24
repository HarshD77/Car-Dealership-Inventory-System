import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const target = new URL('../.env', import.meta.url);
if (existsSync(target)) {
  console.log('backend/.env already exists; it has been preserved.');
} else {
  const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  writeFileSync(
    target,
    example.replace(
      'replace-with-a-random-secret-at-least-32-characters',
      randomBytes(32).toString('hex'),
    ),
    { flag: 'wx' },
  );
  console.log('Created backend/.env with a random JWT secret and the local MongoDB connection.');
}
