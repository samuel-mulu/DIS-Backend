import { prisma } from '../../config/db';
import { RoleName } from '@prisma/client';
import { comparePassword } from '../../utils/hash';
import { generateToken, JWTPayload } from '../../utils/jwt';
import { AuditAction, EntityType } from '@prisma/client';
import { UnauthorizedError } from '../../middleware/error.middleware';
import { AuthenticatedUser, warmAuthUserSnapshot } from '../../utils/auth-user-cache';
import { createAuditLog } from '../../utils/audit';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: CurrentUserResponse;
}

export interface CurrentUserResponse {
  id: string;
  fullName: string;
  email: string;
  role: RoleName;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string | null;
}

const loginUserSelect = {
  id: true,
  fullName: true,
  email: true,
  passwordHash: true,
  isActive: true,
  departmentId: true,
  role: {
    select: {
      name: true,
    },
  },
  department: {
    select: {
      name: true,
    },
  },
} as const;

export function formatCurrentUser(user: AuthenticatedUser): CurrentUserResponse {
  return {
    id: user.userId,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    departmentId: user.departmentId || null,
    departmentName: user.departmentName || null,
  };
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const { email, password } = input;

  const user = await prisma.user.findUnique({
    where: { email },
    select: loginUserSelect,
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

  const authenticatedUser: AuthenticatedUser = {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.name,
    isActive: user.isActive,
    departmentId: user.departmentId || undefined,
    departmentName: user.department?.name || null,
  };

  const payload: JWTPayload = {
    userId: authenticatedUser.userId,
    email: authenticatedUser.email,
    role: authenticatedUser.role,
    departmentId: authenticatedUser.departmentId,
  };

  const token = generateToken(payload);

  await createAuditLog({
    userId: authenticatedUser.userId,
    action: AuditAction.LOGIN,
    entityType: EntityType.USER,
    entityId: authenticatedUser.userId,
  });

  warmAuthUserSnapshot(authenticatedUser);

  return {
    token,
    user: formatCurrentUser(authenticatedUser),
  };
}
