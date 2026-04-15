import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function parsePoolMax(rawValue: string | undefined): number {
  const parsed = Number(rawValue ?? "");
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 2;
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL saknas. Lägg till variabeln i .env.");
  }

  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    // Keep serverless pool tiny to avoid hitting Postgres session limits in Vercel.
    max: parsePoolMax(process.env.PG_POOL_MAX),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
