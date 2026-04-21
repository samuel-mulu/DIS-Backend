import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getLocationsController } from './locations.controller';

const router = Router();

router.use(authenticate);
router.get('/', getLocationsController);

export default router;
