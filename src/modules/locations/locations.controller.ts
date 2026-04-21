import { Response } from 'express';
import { AuthRequest, requireUser } from '../../middleware/auth.middleware';
import { getLocations } from './locations.service';
import { asyncHandler } from '../../utils/async-handler';

export const getLocationsController = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = requireUser(req);
  const locations = await getLocations(user);
  res.json({ data: locations });
});
