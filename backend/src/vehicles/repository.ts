import { ObjectId, type Db } from 'mongodb';
import type { VehicleInput } from './validation.js';

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

export async function listVehicles(db: Db) {
  return (await vehicles(db).find().sort({ make: 1, model: 1, _id: 1 }).toArray()).map(publicVehicle);
}
