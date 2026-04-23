import { prisma } from '../../config/db';
import { AuditAction, EntityType, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CreateUserInput, UpdateUserInput } from './users.validation';
import { createAuditLog } from '../../utils/audit';
import { NotFoundError, ValidationError } from '../../middleware/error.middleware';
import { invalidateAuthUserSnapshot } from '../../utils/auth-user-cache';

const departmentSummarySelect = {
  id: true,
  name: true,
} as const;

const userListSelect = {
  id: true,
  fullName: true,
  email: true,
  isActive: true,
  departmentId: true,
  createdAt: true,
  role: {
    select: {
      name: true,
    },
  },
  department: {
    select: departmentSummarySelect,
  },
  viewerDepartmentAccesses: {
    select: {
      location: {
        select: departmentSummarySelect,
      },
    },
  },
} as const;

const userDetailSelect = {
  id: true,
  fullName: true,
  email: true,
  roleId: true,
  departmentId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      name: true,
    },
  },
  department: {
    select: departmentSummarySelect,
  },
  viewerDepartmentAccesses: {
    select: {
      location: {
        select: departmentSummarySelect,
      },
    },
  },
} as const;

interface DepartmentSummary {
  id: string;
  name: string;
}

type UserWithDepartmentAssignments = {
  departmentId: string | null;
  department: DepartmentSummary | null;
  viewerDepartmentAccesses: Array<{
    location: DepartmentSummary;
  }>;
};

function normalizeDepartmentIds(departmentIds?: Array<string | null | undefined> | null) {
  return Array.from(
    new Set(
      (departmentIds || [])
        .map((departmentId) => departmentId?.trim())
        .filter((departmentId): departmentId is string => !!departmentId)
    )
  );
}

function dedupeDepartments(departments: DepartmentSummary[]) {
  const departmentMap = new Map<string, DepartmentSummary>();

  departments.forEach((department) => {
    departmentMap.set(department.id, department);
  });

  return Array.from(departmentMap.values());
}

function normalizeUserRecord<T extends UserWithDepartmentAssignments>(
  user: T,
  fallbackDepartmentName?: string
) {
  const directDepartment =
    user.department ||
    (user.departmentId && fallbackDepartmentName
      ? {
          id: user.departmentId,
          name: fallbackDepartmentName,
        }
      : null);

  const departments = dedupeDepartments([
    ...(directDepartment ? [directDepartment] : []),
    ...user.viewerDepartmentAccesses.map((assignment) => assignment.location),
  ]);

  return {
    ...user,
    department: directDepartment,
    departments,
    departmentIds: departments.map((department) => department.id),
  };
}

async function loadDepartmentNameById(departmentIds: string[]) {
  if (departmentIds.length === 0) {
    return new Map<string, string>();
  }

  const locations = await prisma.location.findMany({
    where: {
      id: { in: departmentIds },
    },
    select: departmentSummarySelect,
  });

  return new Map(locations.map((location) => [location.id, location.name]));
}

async function assertDepartmentsExist(departmentIds: string[]) {
  if (departmentIds.length === 0) {
    return;
  }

  const uniqueDepartmentIds = normalizeDepartmentIds(departmentIds);
  const existingDepartments = await prisma.location.findMany({
    where: {
      id: { in: uniqueDepartmentIds },
    },
    select: {
      id: true,
    },
  });

  if (existingDepartments.length !== uniqueDepartmentIds.length) {
    throw new ValidationError('One or more selected departments are invalid');
  }
}

function validateDepartmentAssignment(
  roleName: RoleName,
  departmentId?: string | null,
  departmentIds: string[] = []
) {
  if (roleName === RoleName.MEDICATION_MANAGER && !departmentId) {
    throw new ValidationError('Medication manager must be assigned to a department');
  }

  if (roleName === RoleName.VIEWER) {
    if (departmentIds.length === 0) {
      throw new ValidationError('Viewer must be assigned to at least one department');
    }

    if (departmentIds.length > 2) {
      throw new ValidationError('Viewer can only be assigned up to 2 departments');
    }
  }

  if (roleName !== RoleName.VIEWER && departmentIds.length > 0) {
    throw new ValidationError('Only viewer users can be assigned multiple departments');
  }
}

interface GetUsersFilters {
  search?: string;
  role?: RoleName;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export async function getUsers(filters: GetUsersFilters = {}) {
  const { search, role, isActive, page = 1, limit = 10 } = filters;

  const where: any = {};

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (role) {
    where.role = { name: role };
  }

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: userListSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const missingDepartmentIds = normalizeDepartmentIds(
    data
      .filter((user) => user.departmentId && !user.department)
      .map((user) => user.departmentId)
  );
  const locationNameById = await loadDepartmentNameById(missingDepartmentIds);

  const normalizedData = data.map((user) =>
    normalizeUserRecord(user, user.departmentId ? locationNameById.get(user.departmentId) : undefined)
  );

  return {
    data: normalizedData,
    meta: {
      page,
      limit,
      total,
    },
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userDetailSelect,
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  let fallbackDepartmentName: string | undefined;
  if (user.departmentId && !user.department) {
    const locationNameById = await loadDepartmentNameById([user.departmentId]);
    fallbackDepartmentName = locationNameById.get(user.departmentId);
  }

  return normalizeUserRecord(user, fallbackDepartmentName);
}

export async function createUser(input: CreateUserInput, userId: string) {
  const { fullName, email, password, roleId, departmentId } = input;
  const viewerDepartmentIds = normalizeDepartmentIds(input.departmentIds);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ValidationError('Email already exists');
  }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw new ValidationError('Invalid role');
  }

  validateDepartmentAssignment(role.name, departmentId, viewerDepartmentIds);
  await assertDepartmentsExist([
    ...(role.name === RoleName.MEDICATION_MANAGER && departmentId ? [departmentId] : []),
    ...(role.name === RoleName.VIEWER ? viewerDepartmentIds : []),
  ]);

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        roleId,
        departmentId: role.name === RoleName.MEDICATION_MANAGER ? departmentId : null,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (role.name === RoleName.VIEWER && viewerDepartmentIds.length > 0) {
      await tx.viewerDepartmentAccess.createMany({
        data: viewerDepartmentIds.map((locationId) => ({
          userId: createdUser.id,
          locationId,
        })),
      });
    }

    const createdUserDetails = await tx.user.findUnique({
      where: { id: createdUser.id },
      select: userDetailSelect,
    });

    if (!createdUserDetails) {
      throw new NotFoundError('User not found after creation');
    }

    const normalizedCreatedUser = normalizeUserRecord(createdUserDetails);

    await createAuditLog({
      userId,
      action: AuditAction.CREATE_USER,
      entityType: EntityType.USER,
      entityId: normalizedCreatedUser.id,
      newValue: {
        fullName: normalizedCreatedUser.fullName,
        email: normalizedCreatedUser.email,
        roleName: normalizedCreatedUser.role.name,
        departmentId: normalizedCreatedUser.departmentId,
        departmentIds: normalizedCreatedUser.departmentIds,
      },
    }, tx);

    return normalizedCreatedUser;
  });

  invalidateAuthUserSnapshot(user.id);

  return user;
}

export async function updateUser(id: string, input: UpdateUserInput, userId: string) {
  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      roleId: true,
      departmentId: true,
      role: {
        select: {
          name: true,
        },
      },
      viewerDepartmentAccesses: {
        select: {
          locationId: true,
        },
      },
    },
  });

  if (!existingUser) {
    throw new NotFoundError('User not found');
  }

  const { fullName, email, roleId, departmentId } = input;

  if (email && email !== existingUser.email) {
    const duplicateUser = await prisma.user.findUnique({
      where: { email },
    });

    if (duplicateUser) {
      throw new ValidationError('Email already exists');
    }
  }

  let nextRoleId = existingUser.roleId;
  let nextRoleName = existingUser.role.name;
  if (roleId) {
    const roleRecord = await prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!roleRecord) {
      throw new ValidationError('Invalid role');
    }

    nextRoleId = roleRecord.id;
    nextRoleName = roleRecord.name;
  }

  const existingViewerDepartmentIds = existingUser.viewerDepartmentAccesses.map(
    (assignment) => assignment.locationId
  );
  const nextDepartmentId = departmentId !== undefined ? departmentId : existingUser.departmentId;
  const nextViewerDepartmentIds =
    input.departmentIds !== undefined
      ? normalizeDepartmentIds(input.departmentIds)
      : existingViewerDepartmentIds;

  validateDepartmentAssignment(nextRoleName, nextDepartmentId, nextViewerDepartmentIds);
  await assertDepartmentsExist([
    ...(nextRoleName === RoleName.MEDICATION_MANAGER && nextDepartmentId ? [nextDepartmentId] : []),
    ...(nextRoleName === RoleName.VIEWER ? nextViewerDepartmentIds : []),
  ]);

  const oldValue = {
    fullName: existingUser.fullName,
    email: existingUser.email,
    roleId: existingUser.roleId,
    departmentId: existingUser.departmentId,
    departmentIds: existingViewerDepartmentIds,
  };

  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        ...(fullName && { fullName }),
        ...(email && { email }),
        ...(roleId && { roleId: nextRoleId }),
        departmentId: nextRoleName === RoleName.MEDICATION_MANAGER ? nextDepartmentId : null,
      },
    });

    await tx.viewerDepartmentAccess.deleteMany({
      where: { userId: id },
    });

    if (nextRoleName === RoleName.VIEWER && nextViewerDepartmentIds.length > 0) {
      await tx.viewerDepartmentAccess.createMany({
        data: nextViewerDepartmentIds.map((locationId) => ({
          userId: id,
          locationId,
        })),
      });
    }

    const updatedUser = await tx.user.findUnique({
      where: { id },
      select: userDetailSelect,
    });

    if (!updatedUser) {
      throw new NotFoundError('User not found after update');
    }

    const normalizedUpdatedUser = normalizeUserRecord(updatedUser);

    await createAuditLog({
      userId,
      action: AuditAction.UPDATE_USER,
      entityType: EntityType.USER,
      entityId: normalizedUpdatedUser.id,
      oldValue,
      newValue: {
        fullName: normalizedUpdatedUser.fullName,
        email: normalizedUpdatedUser.email,
        roleId: normalizedUpdatedUser.roleId,
        departmentId: normalizedUpdatedUser.departmentId,
        departmentIds: normalizedUpdatedUser.departmentIds,
      },
    }, tx);

    return normalizedUpdatedUser;
  });

  invalidateAuthUserSnapshot(user.id);

  return user;
}

export async function activateUser(id: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const activatedUser = await tx.user.update({
      where: { id },
      data: { isActive: true },
      select: userDetailSelect,
    });

    await createAuditLog({
      userId,
      action: AuditAction.ACTIVATE_USER,
      entityType: EntityType.USER,
      entityId: user.id,
      oldValue: { isActive: false },
      newValue: { isActive: true },
    }, tx);

    return normalizeUserRecord(activatedUser);
  });

  invalidateAuthUserSnapshot(updatedUser.id);

  return updatedUser;
}

export async function deactivateUser(id: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  if (id === userId) {
    throw new ValidationError('You cannot deactivate yourself');
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const deactivatedUser = await tx.user.update({
      where: { id },
      data: { isActive: false },
      select: userDetailSelect,
    });

    await createAuditLog({
      userId,
      action: AuditAction.DEACTIVATE_USER,
      entityType: EntityType.USER,
      entityId: user.id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
    }, tx);

    return normalizeUserRecord(deactivatedUser);
  });

  invalidateAuthUserSnapshot(updatedUser.id);

  return updatedUser;
}
