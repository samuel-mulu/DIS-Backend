import { prisma } from '../../config/db';
import { AuditAction, EntityType, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { CreateUserInput, UpdateUserInput } from './users.validation';
import { createAuditLog } from '../../utils/audit';
import { NotFoundError, ValidationError } from '../../middleware/error.middleware';
import { invalidateAuthUserSnapshot } from '../../utils/auth-user-cache';

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
    select: {
      id: true,
      name: true,
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
    select: {
      id: true,
      name: true,
    },
  },
} as const;

function validateDepartmentAssignment(roleName: RoleName, departmentId?: string | null) {
  if (roleName === RoleName.MEDICATION_MANAGER && !departmentId) {
    throw new ValidationError('Medication manager must be assigned to a department');
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

  const missingDepartmentIds = Array.from(
    new Set(
      data
        .filter((user) => user.departmentId && !user.department)
        .map((user) => user.departmentId as string)
    )
  );

  let locationNameById = new Map<string, string>();
  if (missingDepartmentIds.length > 0) {
    const locations = await prisma.location.findMany({
      where: {
        id: { in: missingDepartmentIds },
      },
      select: {
        id: true,
        name: true,
      },
    });

    locationNameById = new Map(locations.map((location) => [location.id, location.name]));
  }

  const normalizedData = data.map((user) => {
    if (user.department || !user.departmentId) {
      return user;
    }

    const fallbackDepartmentName = locationNameById.get(user.departmentId);
    if (!fallbackDepartmentName) {
      return user;
    }

    return {
      ...user,
      department: {
        id: user.departmentId,
        name: fallbackDepartmentName,
      },
    };
  });

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

  return user;
}

export async function createUser(input: CreateUserInput, userId: string) {
  const { fullName, email, password, roleId, departmentId } = input;

  // Check for duplicate email
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ValidationError('Email already exists');
  }

  // Verify role exists
  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw new ValidationError('Invalid role');
  }

  validateDepartmentAssignment(role.name, departmentId);

  // Hash password
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
      select: userDetailSelect,
    });

    await createAuditLog({
      userId,
      action: AuditAction.CREATE_USER,
      entityType: EntityType.USER,
      entityId: createdUser.id,
      newValue: {
        fullName: createdUser.fullName,
        email: createdUser.email,
        roleName: createdUser.role.name,
        departmentId: createdUser.departmentId,
      },
    }, tx);

    return createdUser;
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
    },
  });

  if (!existingUser) {
    throw new NotFoundError('User not found');
  }

  const { fullName, email, roleId, departmentId } = input;

  // Check for duplicate email if email is being changed
  if (email && email !== existingUser.email) {
    const duplicateUser = await prisma.user.findUnique({
      where: { email },
    });

    if (duplicateUser) {
      throw new ValidationError('Email already exists');
    }
  }

  // Verify role exists if roleId is being changed
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

  const nextDepartmentId = departmentId !== undefined ? departmentId : existingUser.departmentId;
  validateDepartmentAssignment(nextRoleName, nextDepartmentId);

  const oldValue = {
    fullName: existingUser.fullName,
    email: existingUser.email,
    roleId: existingUser.roleId,
    departmentId: existingUser.departmentId,
  };

  const user = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id },
      data: {
        ...(fullName && { fullName }),
        ...(email && { email }),
        ...(roleId && { roleId: nextRoleId }),
        departmentId: nextRoleName === RoleName.MEDICATION_MANAGER ? nextDepartmentId : null,
      },
      select: userDetailSelect,
    });

    await createAuditLog({
      userId,
      action: AuditAction.UPDATE_USER,
      entityType: EntityType.USER,
      entityId: updatedUser.id,
      oldValue,
      newValue: {
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        roleId: updatedUser.roleId,
        departmentId: updatedUser.departmentId,
      },
    }, tx);

    return updatedUser;
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

    return activatedUser;
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

  // Prevent admin from deactivating themselves
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

    return deactivatedUser;
  });

  invalidateAuthUserSnapshot(updatedUser.id);

  return updatedUser;
}
