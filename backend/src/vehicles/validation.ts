import { z } from 'zod';
import { ObjectId } from 'mongodb';

export const vehicleId = z.string().regex(/^[a-fA-F0-9]{24}$/, 'Invalid vehicle ID')
  .transform(value => new ObjectId(value));

const text = z.string().trim().min(1).max(100);
export const vehicleInput = z.object({
  make: text,
  model: text,
  category: text,
  price: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  quantity: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
}).strict();

export type VehicleInput = z.infer<typeof vehicleInput>;

const queryPrice = z.string().regex(/^\d+$/, 'Price must be a nonnegative integer in cents')
  .transform(Number).pipe(z.number().int().max(Number.MAX_SAFE_INTEGER)).optional();
export const searchInput = z.object({
  make: text.optional(), model: text.optional(), category: text.optional(),
  minPrice: queryPrice, maxPrice: queryPrice
}).strict().refine(value => value.minPrice === undefined || value.maxPrice === undefined ||
  value.minPrice <= value.maxPrice, 'Minimum price must not exceed maximum price');

export type SearchInput = z.infer<typeof searchInput>;

export const purchaseInput = z.object({}).strict();
export const restockInput = z.object({
  quantity: z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
}).strict();
