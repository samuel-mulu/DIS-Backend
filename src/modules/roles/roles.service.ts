import { prisma } from '../../config/db';

export async function getRoles() {
  return prisma.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
    },
    orderBy: { name: 'asc' },
  });
}
