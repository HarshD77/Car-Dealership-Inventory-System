import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoServerError, ObjectId, type Db } from 'mongodb';
import { z } from 'zod';
import { users, type UserDocument } from '../database.js';
import { HttpError } from '../errors.js';

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).refine(value => Buffer.byteLength(value, 'utf8') <= 72,
    'Password must be at most 72 UTF-8 bytes')
});
const dummyPasswordHash = bcrypt.hashSync('unused-password-for-timing', 12);

export function authResult(user: UserDocument, secret: string) {
  return {
    user: { id: user._id.toHexString(), email: user.email, role: user.role },
    token: jwt.sign({}, secret, {
      subject: user._id.toHexString(), expiresIn: '1h', algorithm: 'HS256',
      issuer: 'car-dealership', audience: 'car-dealership-ui'
    })
  };
}

export async function register(db: Db, secret: string, input: unknown) {
  return authResult(await createUser(db, input, 'user'), secret);
}

// The role argument is chosen by server code, never from a registration body.
export async function createUser(db: Db, input: unknown, role: UserDocument['role']) {
  const { email, password } = credentials.parse(input);
  const user: UserDocument = {
    _id: new ObjectId(), email, passwordHash: await bcrypt.hash(password, 12), role
  };
  try {
    await users(db).insertOne(user);
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new HttpError(409, 'An account with that email already exists');
    }
    throw error;
  }
  return user;
}

export async function login(db: Db, secret: string, input: unknown) {
  const { email, password } = credentials.parse(input);
  const user = await users(db).findOne({ email });
  // Spend the same hashing work on unknown emails, too.
  const hash = user?.passwordHash ?? dummyPasswordHash;
  const matches = await bcrypt.compare(password, hash);
  if (!user || !matches) throw new HttpError(401, 'Email or password is incorrect');
  return authResult(user, secret);
}
