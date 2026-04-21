import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { RoleName } from '@prisma/client';

export function authorize(...allowedRoles: RoleName[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}
