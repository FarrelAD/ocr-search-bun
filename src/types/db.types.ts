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
  created_at: number;
  updated_at: number;
}

export interface SearchResult extends ImageRecord {
  score: number;
}

export interface DatabaseStats {
  totalImages: number;
  totalTextBytes: number;
  avgConfidence: number;
  lastScannedAt: number | null;
}
