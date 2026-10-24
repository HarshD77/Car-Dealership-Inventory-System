import type { RequestHandler } from 'express';
import { ObjectId, type Db } from 'mongodb';
import jwt from 'jsonwebtoken';
import { users } from '../database.js';
import { HttpError } from '../errors.js';

export function authenticate(db: Db, secret: string): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer ([^ ]+)$/i.exec(req.header('Authorization') ?? '');
    if (!match) throw new HttpError(401, 'Authentication required');
    let subject: string;
    try {
      const claims = jwt.verify(match[1], secret, {
        algorithms: ['HS256'],
        issuer: 'car-dealership',
        audience: 'car-dealership-ui',
      });
      if (
        typeof claims === 'string' ||
        typeof claims.sub !== 'string' ||
        !/^[a-fA-F0-9]{24}$/.test(claims.sub)
      )
        throw new Error('Invalid subject');
      subject = claims.sub;
    } catch {
      throw new HttpError(401, 'Invalid or expired authentication token');
    }
    const user = await users(db).findOne({ _id: new ObjectId(subject) });
    if (!user) throw new HttpError(401, 'Invalid or expired authentication token');
    res.locals.user = { id: user._id.toHexString(), email: user.email, role: user.role };
    next();
  };
}

export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (res.locals.user.role !== 'admin') throw new HttpError(403, 'Admin access required');
  next();
};
