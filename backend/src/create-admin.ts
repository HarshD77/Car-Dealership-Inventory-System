import { z } from 'zod';
import { createUser } from './auth/service.js';
import { connectDatabase } from './database.js';

const uri = z.string().min(1).parse(process.env.MONGODB_URI);
const { client, db } = await connectDatabase(uri);
try {
  const user = await createUser(
    db,
    {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
    'admin',
  );
  console.log(`Admin account created: ${user.email}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not create admin');
  process.exitCode = 1;
} finally {
  await client.close();
}
