import { RoleName } from '@prisma/client';
import { prisma } from '../config/db';

const AUTH_USER_CACHE_TTL_MS = 30_000;

export interface AuthenticatedUser {
  userId: string;
  fullName: string;
  email: string;
  role: RoleName;
  isActive: boolean;
  departmentId?: string;
  departmentName?: string | null;
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
      name: true,
    },
  },
} as const;

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
    name: string;
  } | null;
}): AuthenticatedUser {
  return {
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role.name,
    isActive: user.isActive,
    departmentId: user.departmentId || undefined,
    departmentName: user.department?.name || null,
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
