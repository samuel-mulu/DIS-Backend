import { Request, Response } from 'express';
import { getRoles } from './roles.service';
import { asyncHandler } from '../../utils/async-handler';

export const getRolesController = asyncHandler(async (req: Request, res: Response) => {
  const roles = await getRoles();
  res.json({ data: roles });
});
