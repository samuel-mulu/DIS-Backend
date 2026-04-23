import { RoleName } from '@prisma/client';
import { prisma } from '../../config/db';
import { getAccessibleDepartmentIds } from '../../utils/department-access';

interface LocationActor {
  role: RoleName;
  departmentId?: string;
  departmentIds?: string[];
}

export async function getLocations(actor: LocationActor) {
  if (actor.role !== RoleName.SYSTEM_ADMIN) {
    const departmentIds = getAccessibleDepartmentIds(actor);
    return prisma.location.findMany({
      where: {
        id: {
          in: departmentIds,
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  return prisma.location.findMany({
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: { name: 'asc' },
  });
}
