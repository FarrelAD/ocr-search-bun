import type { OCRLayout } from "./ocr.types.ts";

export interface ScanProgressInfo {
  current: number;
  total: number;
  path: string;
  status: "indexed" | "skipped" | "error";
  confidence?: number;
  blocks?: number;
  lines?: number;
  error?: string;
}

export interface ScanDetail {
  path: string;
  status: "indexed" | "skipped" | "error";
  confidence?: number;
  blocks?: number;
  lines?: number;
  error?: string;
}

export interface ScanResult {
  totalScanned: number;
  indexed: number;
  skipped: number;
  errors: number;
  details: ScanDetail[];
  layout?: OCRLayout | null;
  hocr?: string | null;
}

export interface ScanOptions {
  force?: boolean;
  lang?: string;
  onProgress?: (info: ScanProgressInfo) => void;
}
