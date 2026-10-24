import express from 'express';
import type { Db } from 'mongodb';

export function createApp(_db: Db, _jwtSecret: string) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  return app;
}
