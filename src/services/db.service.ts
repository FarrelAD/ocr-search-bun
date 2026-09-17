import mysql from "mysql2/promise";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, type Image } from "@prisma/client";

import type {
  MySQLConfig,
  ImageInsert,
  ImageRecord,
  SearchResult,
  DatabaseStats,
} from "../types/db.types.ts";

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

export function mapPrismaImageToRecord(image: Image): ImageRecord {
  return {
    id: image.id,
    path: image.path,
    hash: image.hash,
    file_size: Number(image.file_size),
    mtime: Number(image.mtime),
    width: image.width,
    height: image.height,
    ocr_text: image.ocr_text,
    confidence: image.confidence,
    created_at: Number(image.created_at),
    updated_at: Number(image.updated_at),
  };
}

export async function initDb(config?: MySQLConfig): Promise<PrismaClient> {
  const cfg = getDefaultConfig(config);
  const dbUrl = getDatabaseUrl(config);
  process.env.DATABASE_URL = dbUrl;

  // 1. Verify/create database if missing using admin connection
  const adminConn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
  });

  await adminConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
  );
  await adminConn.end();

  // 2. Instantiate Prisma 7 Driver Adapter and PrismaClient
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

  // 3. Fast schema synchronization (ensure images table & indexes exist)
  await activePrisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS images (
      id INT AUTO_INCREMENT PRIMARY KEY,
      path VARCHAR(512) UNIQUE NOT NULL,
      hash VARCHAR(64) NOT NULL,
      file_size BIGINT NOT NULL,
      mtime BIGINT NOT NULL,
      width INT NULL,
      height INT NULL,
      ocr_text LONGTEXT NOT NULL,
      confidence FLOAT NOT NULL,
      created_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      FULLTEXT INDEX idx_ocr_text (ocr_text)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  return activePrisma;
}

export function getPrismaClient(dbClient?: PrismaClient | any): PrismaClient {
  const prisma = (dbClient && typeof dbClient.$connect === "function" ? dbClient : activePrisma);
  if (!prisma) {
    throw new Error("Database pool not initialized. Call initDb() first.");
  }
  return prisma;
}

// Backwards compatibility alias for getPool
export const getPool = getPrismaClient as unknown as (dbPool?: any) => PrismaClient;

export async function closeDb(dbClient?: PrismaClient | any): Promise<void> {
  const prisma = (dbClient && typeof dbClient.$disconnect === "function" ? dbClient : activePrisma);
  if (prisma) {
    await prisma.$disconnect();
    if (prisma === activePrisma) {
      activePrisma = null;
    }
  }
}

export async function upsertImage(
  data: ImageInsert,
  dbClient?: PrismaClient | any
): Promise<ImageRecord> {
  const prisma = getPrismaClient(dbClient);
  const now = BigInt(Date.now());

  const image = await prisma.image.upsert({
    where: { path: data.path },
    update: {
      hash: data.hash,
      file_size: BigInt(data.file_size),
      mtime: BigInt(data.mtime),
      width: data.width ?? null,
      height: data.height ?? null,
      ocr_text: data.ocr_text,
      confidence: data.confidence,
      updated_at: now,
    },
    create: {
      path: data.path,
      hash: data.hash,
      file_size: BigInt(data.file_size),
      mtime: BigInt(data.mtime),
      width: data.width ?? null,
      height: data.height ?? null,
      ocr_text: data.ocr_text,
      confidence: data.confidence,
      created_at: now,
      updated_at: now,
    },
  });

  return mapPrismaImageToRecord(image);
}

export async function getImageByPath(
  path: string,
  dbClient?: PrismaClient | any
): Promise<ImageRecord | null> {
  const prisma = getPrismaClient(dbClient);
  const image = await prisma.image.findUnique({
    where: { path },
  });
  if (!image) return null;
  return mapPrismaImageToRecord(image);
}

export async function getImageByHash(
  hash: string,
  dbClient?: PrismaClient | any
): Promise<ImageRecord | null> {
  const prisma = getPrismaClient(dbClient);
  const image = await prisma.image.findFirst({
    where: { hash },
  });
  if (!image) return null;
  return mapPrismaImageToRecord(image);
}

export async function getAllImages(
  options?: { limit?: number; offset?: number },
  dbClient?: PrismaClient | any
): Promise<{ images: ImageRecord[]; total: number }> {
  const prisma = getPrismaClient(dbClient);
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const [total, images] = await Promise.all([
    prisma.image.count(),
    prisma.image.findMany({
      orderBy: { updated_at: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    images: images.map(mapPrismaImageToRecord),
    total,
  };
}

export async function searchImages(
  query: string,
  options?: { limit?: number; offset?: number },
  dbClient?: PrismaClient | any
): Promise<SearchResult[]> {
  const prisma = getPrismaClient(dbClient);
  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  type RawSearchResult = {
    id: number;
    path: string;
    hash: string;
    file_size: bigint | number;
    mtime: bigint | number;
    width: number | null;
    height: number | null;
    ocr_text: string;
    confidence: number;
    created_at: bigint | number;
    updated_at: bigint | number;
    score: number;
  };

  const rows = await prisma.$queryRaw<RawSearchResult[]>`
    SELECT id, path, hash, file_size, mtime, width, height, ocr_text, confidence, created_at, updated_at,
           MATCH(ocr_text) AGAINST(${trimmed} IN BOOLEAN MODE) AS score
    FROM images
    WHERE MATCH(ocr_text) AGAINST(${trimmed} IN BOOLEAN MODE)
    ORDER BY score DESC, updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return rows.map((r) => ({
    id: Number(r.id),
    path: r.path,
    hash: r.hash,
    file_size: Number(r.file_size),
    mtime: Number(r.mtime),
    width: r.width,
    height: r.height,
    ocr_text: r.ocr_text,
    confidence: Number(r.confidence),
    created_at: Number(r.created_at),
    updated_at: Number(r.updated_at),
    score: Number(r.score),
  }));
}

export async function deleteImage(
  path: string,
  dbClient?: PrismaClient | any
): Promise<boolean> {
  const prisma = getPrismaClient(dbClient);
  try {
    await prisma.image.delete({
      where: { path },
    });
    return true;
  } catch (err: any) {
    if (err?.code === "P2025") {
      return false;
    }
    throw err;
  }
}

export async function getStats(dbClient?: PrismaClient | any): Promise<DatabaseStats> {
  const prisma = getPrismaClient(dbClient);

  type StatsRow = {
    totalImages: bigint | number;
    totalTextBytes: bigint | number;
    avgConfidence: number | null;
    lastScannedAt: bigint | number | null;
  };

  const rows = await prisma.$queryRaw<StatsRow[]>`
    SELECT 
      COUNT(*) AS totalImages,
      COALESCE(SUM(LENGTH(ocr_text)), 0) AS totalTextBytes,
      COALESCE(AVG(confidence), 0) AS avgConfidence,
      MAX(updated_at) AS lastScannedAt
    FROM images
  `;

  const r = rows[0] || {};
  return {
    totalImages: Number(r.totalImages || 0),
    totalTextBytes: Number(r.totalTextBytes || 0),
    avgConfidence: Number(r.avgConfidence || 0),
    lastScannedAt: r.lastScannedAt ? Number(r.lastScannedAt) : null,
  };
}
