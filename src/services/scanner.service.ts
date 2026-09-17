import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type {
  ScanDetail,
  ScanOptions,
  ScanResult,
} from "../types/scanner.types.ts";
import { normalizePath } from "../utils/path.ts";
import { getPrismaClient } from "./db.service.ts";
import {
  getImageByHash,
  getImageByPath,
  upsertImage,
} from "./image.service.ts";
import {
  createOCRWorker,
  extractText,
  terminateWorker,
} from "./ocr.service.ts";
export const SUPPORTED_EXTENSIONS: Record<string, true> = {
  ".png": true,
  ".jpg": true,
  ".jpeg": true,
  ".webp": true,
  ".bmp": true,
  ".tiff": true,
  ".tif": true,
};

export function isSupportedImage(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return Boolean(SUPPORTED_EXTENSIONS[ext]);
}

export async function computeSha256(buffer: Buffer): Promise<string> {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function collectImageFiles(targetPath: string): Promise<string[]> {
  const normalized = normalizePath(targetPath);
  const files: string[] = [];

  try {
    const stat = await fs.stat(normalized);
    if (stat.isFile()) {
      if (isSupportedImage(normalized)) {
        files.push(normalized);
      }
    } else if (stat.isDirectory()) {
      const entries = await fs.readdir(normalized, { withFileTypes: true });
      for (const entry of entries) {
        const fullSubPath = path.join(normalized, entry.name);
        if (entry.isDirectory()) {
          const subFiles = await collectImageFiles(fullSubPath);
          files.push(...subFiles);
        } else if (entry.isFile() && isSupportedImage(fullSubPath)) {
          files.push(normalizePath(fullSubPath));
        }
      }
    }
  } catch (_err) {
    // Return empty list if path cannot be statted/read
  }

  return files;
}

export async function scanPath(
  targetPath: string,
  options?: ScanOptions,
  dbPool?: PrismaClient | any,
): Promise<ScanResult> {
  const pool = getPrismaClient(dbPool);
  const imageFiles = await collectImageFiles(targetPath);

  const result: ScanResult = {
    totalScanned: imageFiles.length,
    indexed: 0,
    skipped: 0,
    errors: 0,
    details: [],
  };

  if (imageFiles.length === 0) {
    return result;
  }

  const lang = options?.lang || process.env.OCR_LANG || "eng";
  const worker = await createOCRWorker(lang);

  try {
    let currentCount = 0;
    for (const filePath of imageFiles) {
      currentCount++;
      const normPath = normalizePath(filePath);

      try {
        const stat = await fs.stat(normPath);
        const buffer = await fs.readFile(normPath);
        const hash = await computeSha256(buffer);

        if (!options?.force) {
          const existingByPath = await getImageByPath(normPath, pool);
          if (existingByPath && existingByPath.hash === hash) {
            result.skipped++;
            const detail: ScanDetail = { path: normPath, status: "skipped" };
            result.details.push(detail);
            options?.onProgress?.({
              current: currentCount,
              total: imageFiles.length,
              path: normPath,
              status: "skipped",
            });
            continue;
          }

          const existingByHash = await getImageByHash(hash, pool);
          if (existingByHash && existingByHash.path === normPath) {
            result.skipped++;
            const detail: ScanDetail = { path: normPath, status: "skipped" };
            result.details.push(detail);
            options?.onProgress?.({
              current: currentCount,
              total: imageFiles.length,
              path: normPath,
              status: "skipped",
            });
            continue;
          }
        }

        const ocrResult = await extractText(buffer, worker, lang);

        await upsertImage(
          {
            path: normPath,
            hash,
            file_size: stat.size,
            mtime: Math.floor(stat.mtimeMs),
            width: ocrResult.width,
            height: ocrResult.height,
            ocr_text: ocrResult.text,
            confidence: ocrResult.confidence,
          },
          pool,
        );

        result.indexed++;
        const detail: ScanDetail = { path: normPath, status: "indexed" };
        result.details.push(detail);
        options?.onProgress?.({
          current: currentCount,
          total: imageFiles.length,
          path: normPath,
          status: "indexed",
        });
      } catch (err: unknown) {
        result.errors++;
        const errMsg = err instanceof Error ? err.message : String(err);
        const detail: ScanDetail = {
          path: normPath,
          status: "error",
          error: errMsg,
        };
        result.details.push(detail);
        options?.onProgress?.({
          current: currentCount,
          total: imageFiles.length,
          path: normPath,
          status: "error",
          error: errMsg,
        });
      }
    }
  } finally {
    await terminateWorker(worker);
  }

  return result;
}
