import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { RoleName } from '@prisma/client';
import { getRolesController } from './roles.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// All routes require SYSTEM_ADMIN role
router.use(authorize(RoleName.SYSTEM_ADMIN));

router.get('/', getRolesController);

export default router;
