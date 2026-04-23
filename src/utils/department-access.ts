import { RoleName } from '@prisma/client';
import { ForbiddenError } from '../middleware/error.middleware';

export interface DepartmentScopedActor {
  role: RoleName;
  departmentId?: string;
  departmentIds?: string[];
}

function getScopeErrorMessage(role: RoleName) {
  return role === RoleName.VIEWER
    ? 'Viewer is not assigned to any departments'
    : 'Medication manager is not assigned to a department';
}

function getAccessErrorMessage(role: RoleName) {
  return role === RoleName.VIEWER
    ? 'You can only access medications in your assigned departments'
    : 'You can only access medications in your department';
}

function getUniqueDepartmentIds(departmentIds: Array<string | null | undefined>) {
  return Array.from(new Set(departmentIds.filter((departmentId): departmentId is string => !!departmentId)));
}

export function getAccessibleDepartmentIds(actor: DepartmentScopedActor) {
  if (actor.role === RoleName.SYSTEM_ADMIN) {
    return [];
  }

  const scopedDepartmentIds =
    actor.role === RoleName.MEDICATION_MANAGER
      ? getUniqueDepartmentIds([actor.departmentId])
      : getUniqueDepartmentIds(actor.departmentIds || []);

  if (scopedDepartmentIds.length === 0) {
    throw new ForbiddenError(getScopeErrorMessage(actor.role));
  }

  return scopedDepartmentIds;
}

export function ensureDepartmentAccess(actor: DepartmentScopedActor, departmentId: string) {
  if (actor.role === RoleName.SYSTEM_ADMIN) {
    return;
  }

  const scopedDepartmentIds = getAccessibleDepartmentIds(actor);
  if (!scopedDepartmentIds.includes(departmentId)) {
    throw new ForbiddenError(getAccessErrorMessage(actor.role));
  }
}

export function buildDepartmentScope(actor: DepartmentScopedActor, departmentId?: string) {
  if (actor.role === RoleName.SYSTEM_ADMIN) {
    return departmentId ? { locationId: departmentId } : {};
  }

  const scopedDepartmentIds = getAccessibleDepartmentIds(actor);

  if (departmentId) {
    ensureDepartmentAccess(actor, departmentId);
    return { locationId: departmentId };
  }

  return scopedDepartmentIds.length === 1
    ? { locationId: scopedDepartmentIds[0] }
    : { locationId: { in: scopedDepartmentIds } };
}
