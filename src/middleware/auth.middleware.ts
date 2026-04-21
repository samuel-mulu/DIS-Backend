import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { verifyToken, JWTPayload } from '../utils/jwt';
import { prisma } from '../config/db';
import { config } from '../config/env';
import { UnauthorizedError } from './error.middleware';

export interface AuthRequest extends Request {
  user?: JWTPayload;
}

export function requireUser(req: AuthRequest): JWTPayload {
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

  let decoded: JWTPayload;
  try {
    decoded = verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }

  try {
    // Verify user still exists and is active with minimal selected fields.
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        isActive: true,
        departmentId: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'User account is inactive' });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: user.role.name,
      departmentId: user.departmentId || undefined,
    };
    
    next();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2024') {
      return res.status(503).json({ message: 'Database is busy. Please retry.' });
    }
    return res.status(503).json({ message: 'Database unavailable. Please retry.' });
  }
}
