import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import type { MySQLConfig } from "../types/db.types.ts";

let activePrisma: PrismaClient | null = null;

export function parseDatabaseUrl(urlStr: string): Required<MySQLConfig> {
  const connectionLimit = Number(process.env.MYSQL_CONNECTION_LIMIT) || 5;
  try {
    const url = new URL(urlStr);
    const host = url.hostname || "127.0.0.1";
    const port = url.port ? Number(url.port) : 3306;
    const user = url.username ? decodeURIComponent(url.username) : "root";
    const password = url.password ? decodeURIComponent(url.password) : "";
    const rawPath = url.pathname.replace(/^\//, "");
    const database = rawPath ? decodeURIComponent(rawPath) : "ocr_search";

    return { host, port, user, password, database, connectionLimit };
  } catch {
    return {
      host: "127.0.0.1",
      port: 3306,
      user: "root",
      password: "",
      database: "ocr_search",
      connectionLimit,
    };
  }
}

export function getDefaultConfig(config?: MySQLConfig): Required<MySQLConfig> {
  const connectionLimit =
    config?.connectionLimit ??
    (Number(process.env.MYSQL_CONNECTION_LIMIT) || 5);

  if (config && Object.keys(config).length > 0) {
    return {
      host: config.host || "127.0.0.1",
      port: config.port || 3306,
      user: config.user || "root",
      password: config.password ?? "",
      database: config.database || "ocr_search",
      connectionLimit,
    };
  }

  if (process.env.DATABASE_URL) {
    return parseDatabaseUrl(process.env.DATABASE_URL);
  }

  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE || "ocr_search",
    connectionLimit,
  };
}

export function getDatabaseUrl(config?: MySQLConfig): string {
  if (
    (!config || Object.keys(config).length === 0) &&
    process.env.DATABASE_URL
  ) {
    return process.env.DATABASE_URL;
  }
  const cfg = getDefaultConfig(config);
  const passPart = cfg.password ? `:${encodeURIComponent(cfg.password)}` : "";
  return `mysql://${cfg.user}${passPart}@${cfg.host}:${cfg.port}/${cfg.database}`;
}

export function createPrismaClient(config?: MySQLConfig): PrismaClient {
  const cfg = getDefaultConfig(config);
  process.env.DATABASE_URL = getDatabaseUrl(config);

  const adapter = new PrismaMariaDb({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectionLimit: cfg.connectionLimit,
  });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV !== "production"
        ? ["error", "info", "warn"]
        : ["error"],
  });
}

export const prisma: PrismaClient = createPrismaClient();

export async function initDb(config?: MySQLConfig): Promise<PrismaClient> {
  if (config && Object.keys(config).length > 0) {
    if (activePrisma) {
      await activePrisma.$disconnect();
    }
    activePrisma = createPrismaClient(config);

    await activePrisma.$connect();
    return activePrisma;
  }

  const client = activePrisma ?? prisma;
  await client.$connect();
  return client;
}

export function getPrismaClient(dbClient?: PrismaClient | any): PrismaClient {
  return dbClient && typeof dbClient.$connect === "function"
    ? dbClient
    : (activePrisma ?? prisma);
}

export async function closeDb(dbClient?: PrismaClient | any): Promise<void> {
  const client =
    dbClient && typeof dbClient.$disconnect === "function"
      ? dbClient
      : (activePrisma ?? prisma);

  if (client) {
    await client.$disconnect();
    if (client === activePrisma) {
      activePrisma = null;
    }
  }
}
