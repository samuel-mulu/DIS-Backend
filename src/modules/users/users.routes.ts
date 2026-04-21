import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { RoleName } from '@prisma/client';
import {
  getUsersController,
  getUserByIdController,
  createUserController,
  updateUserController,
  activateUserController,
  deactivateUserController,
} from './users.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

// All routes require SYSTEM_ADMIN role
router.use(authorize(RoleName.SYSTEM_ADMIN));

router.get('/', getUsersController);
router.get('/:id', getUserByIdController);
router.post('/', createUserController);
router.put('/:id', updateUserController);
router.patch('/:id/activate', activateUserController);
router.patch('/:id/deactivate', deactivateUserController);

export default router;
