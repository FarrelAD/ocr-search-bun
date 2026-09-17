import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import type { MySQLConfig } from "../types/db.types.ts";

let activePrisma: PrismaClient | null = null;

export function getDefaultConfig(config?: MySQLConfig): Required<MySQLConfig> {
  return {
    host: config?.host || process.env.MYSQL_HOST || "127.0.0.1",
    port: config?.port || Number(process.env.MYSQL_PORT) || 3306,
    user: config?.user || process.env.MYSQL_USER || "root",
    password: config?.password ?? process.env.MYSQL_PASSWORD ?? "",
    database: config?.database || process.env.MYSQL_DATABASE || "ocr_search",
  };
}

export function getDatabaseUrl(config?: MySQLConfig): string {
  const cfg = getDefaultConfig(config);
  const passPart = cfg.password ? `:${encodeURIComponent(cfg.password)}` : "";
  return `mysql://${cfg.user}${passPart}@${cfg.host}:${cfg.port}/${cfg.database}`;
}

export async function initDb(config?: MySQLConfig): Promise<PrismaClient> {
  const cfg = getDefaultConfig(config);
  const dbUrl = getDatabaseUrl(config);
  process.env.DATABASE_URL = dbUrl;

  const adapter = new PrismaMariaDb({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectionLimit: 10,
  });

  activePrisma = new PrismaClient({ adapter });

  await activePrisma.$connect();

  return activePrisma;
}

export function getPrismaClient(dbClient?: PrismaClient | any): PrismaClient {
  const prisma =
    dbClient && typeof dbClient.$connect === "function"
      ? dbClient
      : activePrisma;
  if (!prisma) {
    throw new Error("Database pool not initialized. Call initDb() first.");
  }
  return prisma;
}

export async function closeDb(dbClient?: PrismaClient | any): Promise<void> {
  const prisma =
    dbClient && typeof dbClient.$disconnect === "function"
      ? dbClient
      : activePrisma;
  if (prisma) {
    await prisma.$disconnect();
    if (prisma === activePrisma) {
      activePrisma = null;
    }
  }
}
