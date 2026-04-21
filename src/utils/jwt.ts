import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config/env';
import { RoleName } from '@prisma/client';

export interface JWTPayload {
  userId: string;
  email: string;
  role: RoleName;
  departmentId?: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, config.jwtSecret) as JWTPayload;
}
