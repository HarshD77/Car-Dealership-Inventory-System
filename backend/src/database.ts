import { MongoClient, type Db, type ObjectId } from 'mongodb';

export interface UserDocument {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
}

export const users = (db: Db) => db.collection<UserDocument>('users');

export async function initializeDatabase(db: Db) {
  await users(db).createIndex({ email: 1 }, { unique: true });
}

export async function connectDatabase(uri: string) {
  const client = await new MongoClient(uri, { serverSelectionTimeoutMS: 5000 }).connect();
  try {
    const db = client.db();
    await initializeDatabase(db);
    return { client, db };
  } catch (error) {
    await client.close();
    throw error;
  }
}
