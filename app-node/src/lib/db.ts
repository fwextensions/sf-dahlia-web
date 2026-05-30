/**
 * Shared Prisma client singleton for server-side database access.
 *
 * Reuses the same PrismaClient instance across hot-reloads in development
 * to avoid exhausting database connections.
 */

import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
