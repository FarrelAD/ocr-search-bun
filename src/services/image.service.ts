import type { Image, PrismaClient } from "@prisma/client";
import type {
  DatabaseStats,
  ImageInsert,
  ImageRecord,
  SearchResult,
} from "../types/db.types.ts";
import { getPrismaClient } from "./db.service.ts";

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

export async function upsertImage(
  data: ImageInsert,
  dbClient?: PrismaClient | any,
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
  dbClient?: PrismaClient | any,
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
  dbClient?: PrismaClient | any,
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
  dbClient?: PrismaClient | any,
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
  dbClient?: PrismaClient | any,
): Promise<SearchResult[]> {
  const prisma = getPrismaClient(dbClient);
  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const images = await prisma.image.findMany({
    where: {
      ocr_text: {
        search: trimmed,
      },
    },
    take: limit,
    skip: offset,
    orderBy: { updated_at: "desc" },
  });

  return images.map((image) => ({
    ...mapPrismaImageToRecord(image),
    score: 1.0,
  }));
}

export async function deleteImage(
  path: string,
  dbClient?: PrismaClient | any,
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

export async function getStats(
  dbClient?: PrismaClient | any,
): Promise<DatabaseStats> {
  const prisma = getPrismaClient(dbClient);

  const [aggregate, images] = await Promise.all([
    prisma.image.aggregate({
      _count: { _all: true },
      _avg: { confidence: true },
      _max: { updated_at: true },
    }),
    prisma.image.findMany({
      select: { ocr_text: true },
    }),
  ]);

  const totalImages = aggregate._count._all ?? 0;
  const avgConfidence = aggregate._avg.confidence ?? 0;
  const lastScannedAt = aggregate._max.updated_at
    ? Number(aggregate._max.updated_at)
    : null;
  const totalTextBytes = images.reduce(
    (sum, img) => sum + Buffer.byteLength(img.ocr_text, "utf-8"),
    0,
  );

  return {
    totalImages,
    totalTextBytes,
    avgConfidence,
    lastScannedAt,
  };
}
