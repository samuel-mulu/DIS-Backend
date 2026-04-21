import { RoleName } from '@prisma/client';
import { prisma } from '../../config/db';
import { ForbiddenError } from '../../middleware/error.middleware';

interface LocationActor {
  role: RoleName;
  departmentId?: string;
}

export async function getLocations(actor: LocationActor) {
  if (actor.role === RoleName.MEDICATION_MANAGER) {
    if (!actor.departmentId) {
      throw new ForbiddenError('Medication manager is not assigned to a department');
    }

    return prisma.location.findMany({
      where: { id: actor.departmentId },
      orderBy: { name: 'asc' },
    });
  }

  return prisma.location.findMany({
    orderBy: { name: 'asc' },
  });
}
