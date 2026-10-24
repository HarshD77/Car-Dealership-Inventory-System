import { Router } from 'express';
import type { Db } from 'mongodb';
import { login, register } from './service.js';

export function authRoutes(db: Db, secret: string) {
  const router = Router();
  router.post('/register', async (req, res) => {
    res.status(201).json(await register(db, secret, req.body));
  });
  router.post('/login', async (req, res) => {
    res.json(await login(db, secret, req.body));
  });
  return router;
}
