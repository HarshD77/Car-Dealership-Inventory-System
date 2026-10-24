import { randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';

// Never use MONGODB_URI here. Only drop the unique database created by this run.
export async function testDatabase() {
  const uri = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/car_dealership_test';
  const databaseName = new URL(uri).pathname.slice(1);
  if (!/^[a-zA-Z0-9_]+_test$/.test(databaseName)) {
    throw new Error('TEST_MONGODB_URI must name a database ending in _test');
  }
  const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
  const db = client.db(`${databaseName}_${randomUUID().replaceAll('-', '')}`);
  const isolatedUri = new URL(uri);
  isolatedUri.pathname = `/${db.databaseName}`;
  return {
    db, uri: isolatedUri.toString(),
    async close() {
      await db.dropDatabase();
      await client.close();
    }
  };
}
