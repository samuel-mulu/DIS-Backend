import { AuthenticatedUser } from '../utils/auth-user-cache';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
