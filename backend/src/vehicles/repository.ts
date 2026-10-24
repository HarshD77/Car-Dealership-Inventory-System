import { ObjectId, type Db, type Filter } from 'mongodb';
import type { SearchInput, VehicleInput } from './validation.js';
import { HttpError } from '../errors.js';

export interface VehicleDocument extends VehicleInput {
  _id: ObjectId;
}
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
    if (value)
      filter[field] = { $regex: value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  if (search.minPrice !== undefined || search.maxPrice !== undefined) {
    filter.price = {
      ...(search.minPrice !== undefined ? { $gte: search.minPrice } : {}),
      ...(search.maxPrice !== undefined ? { $lte: search.maxPrice } : {}),
    };
  }
  return (await vehicles(db).find(filter).sort({ make: 1, model: 1, _id: 1 }).toArray()).map(
    publicVehicle,
  );
}

export async function replaceVehicle(db: Db, id: ObjectId, input: VehicleInput) {
  const result = await vehicles(db).findOneAndUpdate(
    { _id: id },
    { $set: input },
    { returnDocument: 'after' },
  );
  if (!result) throw new HttpError(404, 'Vehicle not found');
  return publicVehicle(result);
}

export async function deleteVehicle(db: Db, id: ObjectId) {
  const result = await vehicles(db).deleteOne({ _id: id });
  if (!result.deletedCount) throw new HttpError(404, 'Vehicle not found');
}

export async function changeStock(db: Db, id: ObjectId, change: number) {
  // The stock condition and increment happen in ONE MongoDB write.
  // Checking stock in a separate read before writing would allow overselling.
  const quantity = change < 0 ? { $gte: -change } : { $lte: Number.MAX_SAFE_INTEGER - change };
  return vehicles(db).findOneAndUpdate(
    { _id: id, quantity },
    { $inc: { quantity: change } },
    { returnDocument: 'after' },
  );
}
