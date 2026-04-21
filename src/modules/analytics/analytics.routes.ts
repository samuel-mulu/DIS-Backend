import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { RoleName } from '@prisma/client';
import {
  getDashboardSummaryController,
  getRecentStatusChangesController,
  getOutOfStockInsightsController,
} from './analytics.controller';

const router = Router();

// All analytics routes require authentication
router.use(authenticate);

// Allow all dashboard roles: SYSTEM_ADMIN, MEDICATION_MANAGER, VIEWER
const dashboardRoles = [
  RoleName.SYSTEM_ADMIN,
  RoleName.MEDICATION_MANAGER,
  RoleName.VIEWER,
];

router.get(
  '/dashboard-summary',
  authorize(...dashboardRoles),
  getDashboardSummaryController
);

router.get(
  '/recent-status-changes',
  authorize(...dashboardRoles),
  getRecentStatusChangesController
);

router.get(
  '/out-of-stock-insights',
  authorize(...dashboardRoles),
  getOutOfStockInsightsController
);

export default router;
