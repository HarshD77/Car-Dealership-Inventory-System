import { z } from 'zod';

const text = z.string().trim().min(1).max(100);
export const vehicleInput = z.object({
  make: text,
  model: text,
  category: text,
  price: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  quantity: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
}).strict();

export type VehicleInput = z.infer<typeof vehicleInput>;
