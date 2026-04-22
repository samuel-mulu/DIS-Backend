import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { verifyToken } from '../utils/jwt';
import { config } from '../config/env';
import { UnauthorizedError } from './error.middleware';
import { AuthenticatedUser, getAuthUserSnapshot } from '../utils/auth-user-cache';

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function requireUser(req: AuthRequest): AuthenticatedUser {
  if (!req.user) {
    throw new UnauthorizedError('Unauthorized');
  }

  return req.user;
}

function getCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(name.length + 1));
}

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  const cookieToken = getCookieValue(req.headers.cookie, config.authCookieName);
  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    const user = await getAuthUserSnapshot(decoded.userId);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'User account is inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2024') {
      return res.status(503).json({ message: 'Database is busy. Please retry.' });
    }
    return res.status(503).json({ message: 'Database unavailable. Please retry.' });
  }
}
