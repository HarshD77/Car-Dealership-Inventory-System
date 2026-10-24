import type { Db, ObjectId } from 'mongodb';
import { HttpError } from '../errors.js';
import { changeStock, publicVehicle, vehicles } from './repository.js';

export async function adjustStock(db: Db, id: ObjectId, change: number) {
  const result = await changeStock(db, id, change);
  if (result) return publicVehicle(result);
  if (!(await vehicles(db).findOne({ _id: id }, { projection: { _id: 1 } }))) {
    throw new HttpError(404, 'Vehicle not found');
  }
  throw new HttpError(
    409,
    change < 0 ? 'Vehicle is out of stock' : 'Stock exceeds the supported maximum',
  );
}
