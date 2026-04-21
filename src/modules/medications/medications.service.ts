import { prisma } from '../../config/db';
import { MedicationStatus, AuditAction, EntityType, RoleName } from '@prisma/client';
import {
  CreateMedicationInput,
  UpdateMedicationInput,
  ChangeMedicationStatusInput,
} from './medications.validation';
import { createAuditLog } from '../../utils/audit';
import { ForbiddenError, NotFoundError, ValidationError } from '../../middleware/error.middleware';

const medicationListSelect = {
  id: true,
  code: true,
  genericName: true,
  brandName: true,
  strength: true,
  dosageForm: true,
  category: true,
  manufacturer: true,
  description: true,
  status: true,
  locationId: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  location: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
  createdBy: {
    select: { id: true, fullName: true, email: true },
  },
  updatedBy: {
    select: { id: true, fullName: true, email: true },
  },
} as const;

const medicationDetailSelect = {
  ...medicationListSelect,
} as const;

export interface MedicationFilters {
  search?: string;
  status?: MedicationStatus;
  locationId?: string;
  page?: number;
  limit?: number;
}

export interface MedicationActor {
  userId: string;
  role: RoleName;
  departmentId?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

function getManagerDepartmentId(actor: MedicationActor): string {
  if (!actor.departmentId) {
    throw new ForbiddenError('Medication manager is not assigned to a department');
  }
  return actor.departmentId;
}

function ensureDepartmentAccess(actor: MedicationActor, medicationLocationId: string) {
  if (actor.role !== RoleName.MEDICATION_MANAGER) {
    return;
  }

  const departmentId = getManagerDepartmentId(actor);
  if (departmentId !== medicationLocationId) {
    throw new ForbiddenError('You can only access medications in your department');
  }
}

export async function getMedications(filters: MedicationFilters = {}, actor: MedicationActor) {
  const { search, status, locationId, page = 1, limit = 10 } = filters;

  const where: any = {};

  if (search) {
    where.OR = [
      { code: { contains: search, mode: 'insensitive' } },
      { genericName: { contains: search, mode: 'insensitive' } },
      { brandName: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (actor.role === RoleName.MEDICATION_MANAGER) {
    where.locationId = getManagerDepartmentId(actor);
  } else if (locationId) {
    where.locationId = locationId;
  }

  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    prisma.medication.findMany({
      where,
      select: medicationListSelect,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.medication.count({ where }),
  ]);

  return {
    data,
    meta: { page, limit, total },
  };
}

export async function getMedicationById(id: string, actor: MedicationActor) {
  const medication = await prisma.medication.findUnique({
    where: { id },
    select: medicationDetailSelect,
  });

  if (!medication) {
    throw new NotFoundError('Medication not found');
  }

  ensureDepartmentAccess(actor, medication.locationId);

  return medication;
}

export async function createMedication(
  input: CreateMedicationInput,
  actor: MedicationActor
) {
  const { code, ...rest } = input;
  const userId = actor.userId;

  if (actor.role === RoleName.MEDICATION_MANAGER) {
    const departmentId = getManagerDepartmentId(actor);
    if (input.locationId !== departmentId) {
      throw new ForbiddenError('You can only create medications in your department');
    }
  }

  const existingMedication = await prisma.medication.findUnique({
    where: { code },
  });

  if (existingMedication) {
    throw new ValidationError('Medication with this code already exists');
  }

  const medication = await prisma.medication.create({
    data: {
      ...rest,
      code,
      status: input.status || MedicationStatus.AVAILABLE,
      createdById: userId,
      updatedById: userId,
    },
    select: medicationListSelect,
  });

  await createAuditLog({
    userId,
    action: AuditAction.CREATE,
    entityType: EntityType.MEDICATION,
    entityId: medication.id,
    newValue: medication,
  });

  return medication;
}

export async function updateMedication(
  id: string,
  input: UpdateMedicationInput,
  actor: MedicationActor
) {
  const userId = actor.userId;
  const medication = await prisma.medication.findUnique({
    where: { id },
    select: {
      id: true,
      locationId: true,
    },
  });

  if (!medication) {
    throw new NotFoundError('Medication not found');
  }

  ensureDepartmentAccess(actor, medication.locationId);

  if (actor.role === RoleName.MEDICATION_MANAGER && input.locationId && input.locationId !== medication.locationId) {
    throw new ForbiddenError('You cannot move medication to another department');
  }

  const updatedMedication = await prisma.medication.update({
    where: { id },
    data: {
      ...input,
      updatedById: userId,
    },
    select: medicationListSelect,
  });

  await createAuditLog({
    userId,
    action: AuditAction.UPDATE,
    entityType: EntityType.MEDICATION,
    entityId: medication.id,
    oldValue: medication,
    newValue: updatedMedication,
  });

  return updatedMedication;
}

export async function changeMedicationStatus(
  id: string,
  input: ChangeMedicationStatusInput,
  actor: MedicationActor
) {
  const userId = actor.userId;
  const medication = await prisma.medication.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      locationId: true,
    },
  });

  if (!medication) {
    throw new NotFoundError('Medication not found');
  }

  ensureDepartmentAccess(actor, medication.locationId);

  const oldStatus = medication.status;
  const { newStatus, reason } = input;

  if (oldStatus === newStatus) {
    throw new ValidationError('New status must be different from current status');
  }

  const updatedMedication = await prisma.medication.update({
    where: { id },
    data: {
      status: newStatus,
      updatedById: userId,
    },
    select: medicationListSelect,
  });

  await prisma.statusHistory.create({
    data: {
      medicationId: id,
      oldStatus,
      newStatus,
      reason,
      changedById: userId,
    },
  });

  await createAuditLog({
    userId,
    action: AuditAction.STATUS_CHANGE,
    entityType: EntityType.MEDICATION,
    entityId: medication.id,
    oldValue: { status: oldStatus },
    newValue: { status: newStatus, reason },
  });

  return updatedMedication;
}

export async function getMedicationStatusHistory(medicationId: string, actor: MedicationActor) {
  const medication = await prisma.medication.findUnique({
    where: { id: medicationId },
    select: {
      locationId: true,
    },
  });

  if (!medication) {
    throw new NotFoundError('Medication not found');
  }

  ensureDepartmentAccess(actor, medication.locationId);

  const history = await prisma.statusHistory.findMany({
    where: { medicationId },
    include: {
      changedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
    orderBy: { changedAt: 'desc' },
  });

  return history;
}
