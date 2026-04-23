import { RoleName } from '@prisma/client';
import { prisma } from '../config/db';

const AUTH_USER_CACHE_TTL_MS = 30_000;

interface AuthDepartmentSummary {
  id: string;
  name: string;
}

export interface AuthenticatedUser {
  userId: string;
  fullName: string;
  email: string;
  role: RoleName;
  isActive: boolean;
  departmentId?: string;
  departmentName?: string | null;
  departmentIds: string[];
  departments: AuthDepartmentSummary[];
}

interface CacheEntry {
  value: AuthenticatedUser;
  expiresAt: number;
}

const authUserCache = new Map<string, CacheEntry>();
const inFlightLookups = new Map<string, Promise<AuthenticatedUser | null>>();

const authUserSelect = {
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
  viewerDepartmentAccesses: {
    select: {
      location: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const;

function dedupeDepartments(departments: AuthDepartmentSummary[]) {
  const departmentMap = new Map<string, AuthDepartmentSummary>();

  departments.forEach((department) => {
    departmentMap.set(department.id, department);
  });

  return Array.from(departmentMap.values());
}

function buildAuthenticatedUser(user: {
  id: string;
  fullName: string;
  email: string;
  isActive: boolean;
  departmentId: string | null;
  role: {
    name: RoleName;
  };
  department: {
    id: string;
    name: string;
  } | null;
  viewerDepartmentAccesses: Array<{
    location: {
      id: string;
      name: string;
    };
  }>;
}): AuthenticatedUser {
  const departments = dedupeDepartments([
    ...(user.department ? [{ id: user.department.id, name: user.department.name }] : []),
    ...user.viewerDepartmentAccesses.map((assignment) => assignment.location),
  ]);

  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.name,
    isActive: user.isActive,
    departmentId: user.departmentId || undefined,
    departmentName: user.department?.name || null,
    departmentIds: departments.map((department) => department.id),
    departments,
  };
}

function setCacheEntry(user: AuthenticatedUser) {
  authUserCache.set(user.userId, {
    value: user,
    expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS,
  });
}

async function loadAuthUserSnapshot(userId: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: authUserSelect,
  });

  if (!user) {
    authUserCache.delete(userId);
    return null;
  }

  const snapshot = buildAuthenticatedUser(user);
  setCacheEntry(snapshot);
  return snapshot;
}

export function warmAuthUserSnapshot(user: AuthenticatedUser) {
  setCacheEntry(user);
}

export function invalidateAuthUserSnapshot(userId: string) {
  authUserCache.delete(userId);
  inFlightLookups.delete(userId);
}

export async function getAuthUserSnapshot(userId: string): Promise<AuthenticatedUser | null> {
  const cached = authUserCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existingLookup = inFlightLookups.get(userId);
  if (existingLookup) {
    return existingLookup;
  }

  const lookup = loadAuthUserSnapshot(userId).finally(() => {
    inFlightLookups.delete(userId);
  });

  inFlightLookups.set(userId, lookup);
  return lookup;
}
