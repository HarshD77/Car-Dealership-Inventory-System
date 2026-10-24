import { Router } from 'express';
import type { Db } from 'mongodb';
import { insertVehicle, listVehicles } from './repository.js';
import { vehicleInput } from './validation.js';

export function vehicleRoutes(db: Db) {
  const router = Router();
  router.post('/', async (req, res) => {
    res.status(201).json(await insertVehicle(db, vehicleInput.parse(req.body)));
  });
  router.get('/', async (_req, res) => {
    res.json(await listVehicles(db));
  });
  return router;
}
