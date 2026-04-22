import { Response } from 'express';
import {
  getDashboardOverview,
  getDashboardSummary,
  getRecentStatusChanges,
  getOutOfStockInsights,
} from './analytics.service';
import { asyncHandler } from '../../utils/async-handler';
import { parsePagination, sanitizeQueryValue } from '../../utils/query';
import { AuthRequest, requireUser } from '../../middleware/auth.middleware';

export const getDashboardSummaryController = asyncHandler(async (
  req: AuthRequest,
  res: Response
) => {
  const user = requireUser(req);
  const locationId = sanitizeQueryValue(req.query.locationId);
  const summary = await getDashboardSummary(user, locationId);
  res.json({ data: summary });
});

export const getDashboardOverviewController = asyncHandler(async (
  req: AuthRequest,
  res: Response
) => {
  const user = requireUser(req);
  const { limit } = parsePagination(req.query);
  const locationId = sanitizeQueryValue(req.query.locationId);
  const overview = await getDashboardOverview(user, locationId, limit, limit);
  res.json({ data: overview });
});

export const getRecentStatusChangesController = asyncHandler(async (
  req: AuthRequest,
  res: Response
) => {
  const user = requireUser(req);
  const { limit } = parsePagination(req.query);
  const locationId = sanitizeQueryValue(req.query.locationId);
  const changes = await getRecentStatusChanges(user, limit, locationId);
  res.json({ data: changes });
});

export const getOutOfStockInsightsController = asyncHandler(async (
  req: AuthRequest,
  res: Response
) => {
  const user = requireUser(req);
  const { limit } = parsePagination(req.query);
  const locationId = sanitizeQueryValue(req.query.locationId);
  const insights = await getOutOfStockInsights(user, locationId, limit);
  res.json({ data: insights });
});
