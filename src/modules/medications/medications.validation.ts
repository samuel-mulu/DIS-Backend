import { z } from 'zod';
import { MedicationStatus } from '@prisma/client';

export const createMedicationSchema = z.object({
  genericName: z.string().min(1, 'Generic name is required'),
  strength: z.string().min(1, 'Strength is required'),
  dosageForm: z.string().min(1, 'Dosage form is required'),
  locationId: z.string().min(1, 'Location is required'),
  status: z.nativeEnum(MedicationStatus).optional(),
});

export const updateMedicationSchema = z.object({
  genericName: z.string().min(1, 'Generic name is required').optional(),
  strength: z.string().min(1, 'Strength is required').optional(),
  dosageForm: z.string().min(1, 'Dosage form is required').optional(),
  locationId: z.string().min(1, 'Location is required').optional(),
});

export const changeMedicationStatusSchema = z.object({
  newStatus: z.nativeEnum(MedicationStatus),
  reason: z.string().min(1, 'Reason is required'),
});

export type CreateMedicationInput = z.infer<typeof createMedicationSchema>;
export type UpdateMedicationInput = z.infer<typeof updateMedicationSchema>;
export type ChangeMedicationStatusInput = z.infer<typeof changeMedicationStatusSchema>;
