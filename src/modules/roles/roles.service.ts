import { prisma } from '../../config/db';

export async function getRoles() {
  return prisma.role.findMany({
    orderBy: { name: 'asc' },
  });
}
