import { prisma } from '../../config/db';
import { RoleName } from '@prisma/client';
import { comparePassword } from '../../utils/hash';
import { generateToken, JWTPayload } from '../../utils/jwt';
import { AuditAction, EntityType } from '@prisma/client';
import { NotFoundError, UnauthorizedError } from '../../middleware/error.middleware';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: RoleName;
  };
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const { email, password } = input;

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      fullName: true,
      email: true,
      passwordHash: true,
      isActive: true,
      roleId: true,
      departmentId: true,
    },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('User account is inactive');
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const role = await prisma.role.findUnique({
    where: { id: user.roleId },
    select: { name: true },
  });

  if (!role) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: role.name,
    departmentId: user.departmentId || undefined,
  };

  const token = generateToken(payload);

  // Create audit log for login
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: EntityType.USER,
      entityId: user.id,
    },
  });

  return {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: role.name,
    },
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      isActive: true,
      departmentId: true,
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
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.name,
    isActive: user.isActive,
    departmentId: user.departmentId,
    departmentName: user.department?.name || null,
  };
}
