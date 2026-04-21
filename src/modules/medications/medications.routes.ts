import { Router } from 'express';
import {
  getMedicationsController,
  getMedicationByIdController,
  createMedicationController,
  updateMedicationController,
  changeMedicationStatusController,
  getMedicationStatusHistoryController,
} from './medications.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { RoleName } from '@prisma/client';

const router = Router();

// All authenticated users can read
router.get('/', authenticate, getMedicationsController);
router.get('/:id', authenticate, getMedicationByIdController);
router.get('/:id/status-history', authenticate, getMedicationStatusHistoryController);

// Only SYSTEM_ADMIN and MEDICATION_MANAGER can write
router.post(
  '/',
  authenticate,
  authorize(RoleName.SYSTEM_ADMIN, RoleName.MEDICATION_MANAGER),
  createMedicationController
);

router.put(
  '/:id',
  authenticate,
  authorize(RoleName.SYSTEM_ADMIN, RoleName.MEDICATION_MANAGER),
  updateMedicationController
);

router.patch(
  '/:id/status',
  authenticate,
  authorize(RoleName.SYSTEM_ADMIN, RoleName.MEDICATION_MANAGER),
  changeMedicationStatusController
);

export default router;
