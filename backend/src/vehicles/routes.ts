import { Router } from 'express';
import type { Db } from 'mongodb';
import { deleteVehicle, insertVehicle, listVehicles, replaceVehicle } from './repository.js';
import { purchaseInput, restockInput, searchInput, vehicleId, vehicleInput } from './validation.js';
import { requireAdmin } from '../auth/middleware.js';
import { adjustStock } from './inventory.js';

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
    res.json(
      await replaceVehicle(db, vehicleId.parse(req.params.id), vehicleInput.parse(req.body)),
    );
  });
  router.delete('/:id', requireAdmin, async (req, res) => {
    await deleteVehicle(db, vehicleId.parse(req.params.id));
    res.status(204).end();
  });
  router.post('/:id/purchase', async (req, res) => {
    purchaseInput.parse(req.body ?? {});
    res.json(await adjustStock(db, vehicleId.parse(req.params.id), -1));
  });
  router.post('/:id/restock', requireAdmin, async (req, res) => {
    const { quantity } = restockInput.parse(req.body);
    res.json(await adjustStock(db, vehicleId.parse(req.params.id), quantity));
  });
  return router;
}
