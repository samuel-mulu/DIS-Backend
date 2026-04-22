import { Request, Response, NextFunction } from 'express';
import { formatCurrentUser, login } from './auth.service';
import { AuthRequest, requireUser } from '../../middleware/auth.middleware';
import { loginSchema } from './auth.validation';
import { config } from '../../config/env';
import { asyncHandler } from '../../utils/async-handler';

const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.nodeEnv === 'production',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const loginController = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const result = await login(input);

  res.cookie(config.authCookieName, result.token, authCookieOptions);
  res.json({ user: result.user });
});

export async function logoutController(req: Request, res: Response) {
  res.clearCookie(config.authCookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
  });

  res.json({ success: true });
}

export const getCurrentUserController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  res.json(formatCurrentUser(user));
});
