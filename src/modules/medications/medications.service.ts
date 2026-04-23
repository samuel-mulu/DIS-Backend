import { prisma } from '../../config/db';
import { MedicationStatus, AuditAction, EntityType, RoleName } from '@prisma/client';
import {
  CreateMedicationInput,
  UpdateMedicationInput,
  ChangeMedicationStatusInput,
} from './medications.validation';
import { createAuditLog } from '../../utils/audit';
import { ForbiddenError, NotFoundError, ValidationError } from '../../middleware/error.middleware';
import { buildDepartmentScope, ensureDepartmentAccess } from '../../utils/department-access';

const medicationListSelect = {
  id: true,
  genericName: true,
  strength: true,
  dosageForm: true,
  status: true,
  updatedAt: true,
  location: {
    select: {
      id: true,
      name: true,
    },
  },
} as const;

const medicationDetailSelect = {
  id: true,
  genericName: true,
  strength: true,
  dosageForm: true,
  status: true,
  locationId: true,
  createdAt: true,
  updatedAt: true,
  location: {
    select: {
      id: true,
      name: true,
    },
  },
  createdBy: {
    select: { id: true, fullName: true },
  },
  updatedBy: {
    select: { id: true, fullName: true },
  },
} as const;

const medicationAuditSelect = {
  id: true,
  genericName: true,
  strength: true,
  dosageForm: true,
  status: true,
  locationId: true,
  updatedAt: true,
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
  departmentIds?: string[];
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}

function buildMedicationAuditSnapshot(medication: {
  id: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  status: MedicationStatus;
  locationId: string;
  updatedAt: Date;
}) {
  return {
    id: medication.id,
    genericName: medication.genericName,
    strength: medication.strength,
    dosageForm: medication.dosageForm,
    status: medication.status,
    locationId: medication.locationId,
    updatedAt: medication.updatedAt,
  };
}

export async function getMedications(filters: MedicationFilters = {}, actor: MedicationActor) {
  const { search, status, locationId, page = 1, limit = 10 } = filters;

  const where: any = {};

  if (search) {
    where.OR = [
      { genericName: { contains: search, mode: 'insensitive' } },
      { strength: { contains: search, mode: 'insensitive' } },
      { dosageForm: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (status) {
    where.status = status;
  }

  Object.assign(where, buildDepartmentScope(actor, locationId));

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
  const { ...rest } = input;
  const userId = actor.userId;

  if (actor.role === RoleName.MEDICATION_MANAGER) {
    ensureDepartmentAccess(actor, input.locationId);
  }

  const medication = await prisma.$transaction(async (tx) => {
    const createdMedication = await tx.medication.create({
      data: {
        ...rest,
        status: input.status || MedicationStatus.AVAILABLE,
        createdById: userId,
        updatedById: userId,
      },
      select: medicationDetailSelect,
    });

    await createAuditLog({
      userId,
      action: AuditAction.CREATE,
      entityType: EntityType.MEDICATION,
      entityId: createdMedication.id,
      newValue: buildMedicationAuditSnapshot(createdMedication),
    }, tx);

    return createdMedication;
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
    select: medicationAuditSelect,
  });

  if (!medication) {
    throw new NotFoundError('Medication not found');
  }

  ensureDepartmentAccess(actor, medication.locationId);

  if (actor.role === RoleName.MEDICATION_MANAGER && input.locationId && input.locationId !== medication.locationId) {
    throw new ForbiddenError('You cannot move medication to another department');
  }

  const updatedMedication = await prisma.$transaction(async (tx) => {
    const medicationAfterUpdate = await tx.medication.update({
      where: { id },
      data: {
        ...input,
        updatedById: userId,
      },
      select: medicationDetailSelect,
    });

    await createAuditLog({
      userId,
      action: AuditAction.UPDATE,
      entityType: EntityType.MEDICATION,
      entityId: medication.id,
      oldValue: buildMedicationAuditSnapshot(medication),
      newValue: buildMedicationAuditSnapshot(medicationAfterUpdate),
    }, tx);

    return medicationAfterUpdate;
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
    select: medicationAuditSelect,
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

  const updatedMedication = await prisma.$transaction(async (tx) => {
    const medicationAfterStatusChange = await tx.medication.update({
      where: { id },
      data: {
        status: newStatus,
        updatedById: userId,
      },
      select: medicationDetailSelect,
    });

    await tx.statusHistory.create({
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
    }, tx);

    return medicationAfterStatusChange;
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
        select: { id: true, fullName: true },
      },
    },
    orderBy: { changedAt: 'desc' },
  });

  return history;
}
