import { ObjectId, type Db, type Filter } from 'mongodb';
import type { SearchInput, VehicleInput } from './validation.js';

export interface VehicleDocument extends VehicleInput { _id: ObjectId }
export const vehicles = (db: Db) => db.collection<VehicleDocument>('vehicles');
export function publicVehicle({ _id, ...vehicle }: VehicleDocument) {
  return { id: _id.toHexString(), ...vehicle };
}

export async function insertVehicle(db: Db, input: VehicleInput) {
  const vehicle = { _id: new ObjectId(), ...input };
  await vehicles(db).insertOne(vehicle);
  return publicVehicle(vehicle);
}

export async function listVehicles(db: Db, search: SearchInput = {}) {
  const filter: Filter<VehicleDocument> = {};
  for (const field of ['make', 'model', 'category'] as const) {
    const value = search[field];
    if (value) filter[field] = { $regex: value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (search.minPrice !== undefined || search.maxPrice !== undefined) {
    filter.price = {
      ...(search.minPrice !== undefined ? { $gte: search.minPrice } : {}),
      ...(search.maxPrice !== undefined ? { $lte: search.maxPrice } : {})
    };
  }
  return (await vehicles(db).find(filter).sort({ make: 1, model: 1, _id: 1 }).toArray()).map(publicVehicle);
}
