import express from 'express';
import type { Db } from 'mongodb';
import { authRoutes } from './auth/routes.js';
import { errorHandler } from './errors.js';
import { authenticate } from './auth/middleware.js';
import { vehicleRoutes } from './vehicles/routes.js';

export function createApp(db: Db, jwtSecret: string) {
  const app = express();
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/auth', authRoutes(db, jwtSecret));
  app.use('/api/vehicles', authenticate(db, jwtSecret), vehicleRoutes(db));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
  app.use(errorHandler);
  return app;
}
