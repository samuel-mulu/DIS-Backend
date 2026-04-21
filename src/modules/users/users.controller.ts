import { Request, Response } from 'express';
import { RoleName } from '@prisma/client';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  activateUser,
  deactivateUser,
} from './users.service';
import { createUserSchema, updateUserSchema } from './users.validation';
import { AuthRequest, requireUser } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { parseBooleanQuery, parseEnumQuery, parsePagination, sanitizeQueryValue } from '../../utils/query';

export const getUsersController = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit } = parsePagination(req.query);
  const role = parseEnumQuery(req.query.role, Object.values(RoleName));

  const result = await getUsers({
    search: sanitizeQueryValue(req.query.search),
    role,
    isActive: parseBooleanQuery(req.query.isActive),
    page,
    limit,
  });

  res.json(result);
});

export const getUserByIdController = asyncHandler(async (req: Request, res: Response) => {
  const user = await getUserById(req.params.id);
  res.json({ data: user });
});

export const createUserController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const input = createUserSchema.parse(req.body);
  const user = requireUser(req);
  const createdUser = await createUser(input, user.userId);

  res.status(201).json({ data: createdUser });
});

export const updateUserController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const input = updateUserSchema.parse(req.body);
  const user = requireUser(req);
  const updatedUser = await updateUser(req.params.id, input, user.userId);

  res.json({ data: updatedUser });
});

export const activateUserController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const updatedUser = await activateUser(req.params.id, user.userId);

  res.json({ data: updatedUser });
});

export const deactivateUserController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const updatedUser = await deactivateUser(req.params.id, user.userId);

  res.json({ data: updatedUser });
});
