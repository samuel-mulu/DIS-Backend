import { z } from 'zod';
import { MedicationStatus } from '@prisma/client';

export const createMedicationSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  genericName: z.string().min(1, 'Generic name is required'),
  brandName: z.string().min(1, 'Brand name is required'),
  strength: z.string().min(1, 'Strength is required'),
  dosageForm: z.string().min(1, 'Dosage form is required'),
  category: z.string().min(1, 'Category is required'),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  description: z.string().optional(),
  locationId: z.string().min(1, 'Location is required'),
  status: z.nativeEnum(MedicationStatus).optional(),
});

export const updateMedicationSchema = z.object({
  code: z.string().min(1, 'Code is required').optional(),
  genericName: z.string().min(1, 'Generic name is required').optional(),
  brandName: z.string().min(1, 'Brand name is required').optional(),
  strength: z.string().min(1, 'Strength is required').optional(),
  dosageForm: z.string().min(1, 'Dosage form is required').optional(),
  category: z.string().min(1, 'Category is required').optional(),
  manufacturer: z.string().min(1, 'Manufacturer is required').optional(),
  description: z.string().optional(),
  locationId: z.string().min(1, 'Location is required').optional(),
});

export const changeMedicationStatusSchema = z.object({
  newStatus: z.nativeEnum(MedicationStatus),
  reason: z.string().min(1, 'Reason is required'),
});

export type CreateMedicationInput = z.infer<typeof createMedicationSchema>;
export type UpdateMedicationInput = z.infer<typeof updateMedicationSchema>;
export type ChangeMedicationStatusInput = z.infer<typeof changeMedicationStatusSchema>;
