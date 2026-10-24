import { Router } from 'express';
import type { Db } from 'mongodb';
import { deleteVehicle, insertVehicle, listVehicles, replaceVehicle } from './repository.js';
import { searchInput, vehicleId, vehicleInput } from './validation.js';
import { requireAdmin } from '../auth/middleware.js';

export function vehicleRoutes(db: Db) {
  const router = Router();
  router.post('/', async (req, res) => {
    res.status(201).json(await insertVehicle(db, vehicleInput.parse(req.body)));
  });
  router.get('/', async (_req, res) => {
    res.json(await listVehicles(db));
  });
  router.get('/search', async (req, res) => {
    res.json(await listVehicles(db, searchInput.parse(req.query)));
  });
  router.put('/:id', async (req, res) => {
    res.json(await replaceVehicle(db, vehicleId.parse(req.params.id), vehicleInput.parse(req.body)));
  });
  router.delete('/:id', requireAdmin, async (req, res) => {
    await deleteVehicle(db, vehicleId.parse(req.params.id));
    res.status(204).end();
  });
  return router;
}
