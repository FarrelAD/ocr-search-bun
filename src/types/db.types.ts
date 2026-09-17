import type { OCRLayout } from "./ocr.types.ts";

export interface MySQLConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  connectionLimit?: number;
}

export interface ImageInsert {
  path: string;
  hash: string;
  file_size: number;
  mtime: number;
  width?: number | null;
  height?: number | null;
  ocr_text: string;
  confidence: number;
  ocr_layout?: string | null;
}

export interface ImageRecord {
  id: number;
  path: string;
  hash: string;
  file_size: number;
  mtime: number;
  width: number | null;
  height: number | null;
  ocr_text: string;
  confidence: number;
  ocr_layout?: string | null;
  layout?: OCRLayout | null;
  created_at: number;
  updated_at: number;
}

export interface SearchResult extends ImageRecord {
  score: number;
  layout?: OCRLayout | null;
}

export interface DatabaseStats {
  totalImages: number;
  totalTextBytes: number;
  avgConfidence: number;
  lastScannedAt: number | null;
}
