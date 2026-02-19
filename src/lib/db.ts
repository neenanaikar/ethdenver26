import { PrismaClient } from '@prisma/client'

// Prevent multiple Prisma instances in development (hot reload creates new instances)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
