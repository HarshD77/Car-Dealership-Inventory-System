import { z } from 'zod';

const configSchema = z.object({
  MONGODB_URI: z
    .string()
    .regex(
      /^mongodb(?:\+srv)?:\/\/[^/]+\/[^?\s/]+(?:\?.*)?$/,
      'MongoDB URI must include a database name',
    ),
  JWT_SECRET: z
    .string()
    .min(32)
    .refine((value) => !value.startsWith('replace-'), 'Replace the example JWT secret'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export function readConfig(env: Record<string, string | undefined>) {
  const config = configSchema.parse(env);
  return { mongoUri: config.MONGODB_URI, jwtSecret: config.JWT_SECRET, port: config.PORT };
}
