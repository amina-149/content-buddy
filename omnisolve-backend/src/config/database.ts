import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export function getDatabaseClient() {
  return prisma;
}

export async function initializeDatabase() {
  await prisma.$connect();
}
