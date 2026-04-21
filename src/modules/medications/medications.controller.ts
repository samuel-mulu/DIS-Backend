import { Response } from 'express';
import {
  getMedications,
  getMedicationById,
  createMedication,
  updateMedication,
  changeMedicationStatus,
  getMedicationStatusHistory,
  MedicationFilters,
} from './medications.service';
import {
  createMedicationSchema,
  updateMedicationSchema,
  changeMedicationStatusSchema,
} from './medications.validation';
import { AuthRequest, requireUser } from '../../middleware/auth.middleware';
import { asyncHandler } from '../../utils/async-handler';
import { MedicationStatus } from '@prisma/client';
import { parseEnumQuery, parsePagination, sanitizeQueryValue } from '../../utils/query';

export const getMedicationsController = asyncHandler(async (
  req: AuthRequest,
  res: Response
) => {
  const user = requireUser(req);
  const { page, limit } = parsePagination(req.query);
  const status = parseEnumQuery(req.query.status, Object.values(MedicationStatus));

  const filters: MedicationFilters = {
    search: sanitizeQueryValue(req.query.search),
    status,
    locationId: sanitizeQueryValue(req.query.locationId),
    page,
    limit,
  };

  const result = await getMedications(filters, user);
  res.json({ data: result.data, meta: result.meta });
});

export const getMedicationByIdController = asyncHandler(async (
  req: AuthRequest,
  res: Response
) => {
  const user = requireUser(req);
  const medication = await getMedicationById(req.params.id, user);
  res.json({ data: medication });
});

export const createMedicationController = asyncHandler(async (
  req: AuthRequest,
  res: Response
) => {
  const input = createMedicationSchema.parse(req.body);
  const user = requireUser(req);
  const medication = await createMedication(input, user);

  res.status(201).json({ data: medication });
});

export const updateMedicationController = asyncHandler(async (
  req: AuthRequest,
  res: Response
) => {
  const input = updateMedicationSchema.parse(req.body);
  const user = requireUser(req);
  const medication = await updateMedication(req.params.id, input, user);

  res.json({ data: medication });
});

export const changeMedicationStatusController = asyncHandler(async (
  req: AuthRequest,
  res: Response
) => {
  const input = changeMedicationStatusSchema.parse(req.body);
  const user = requireUser(req);
  const medication = await changeMedicationStatus(req.params.id, input, user);

  res.json({ data: medication });
});

export const getMedicationStatusHistoryController = asyncHandler(async (
  req: AuthRequest,
  res: Response
) => {
  const user = requireUser(req);
  const history = await getMedicationStatusHistory(req.params.id, user);
  res.json({ data: history });
});
