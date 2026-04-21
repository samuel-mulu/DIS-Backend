import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['error'],
});

export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

export async function disconnectDB() {
  await prisma.$disconnect();
}
