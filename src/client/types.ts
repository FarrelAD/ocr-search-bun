import type {
  DatabaseStats,
  ImageRecord,
  SearchResult,
} from "../types/db.types.ts";
import type {
  OCRBBox,
  OCRBlock,
  OCRLayout,
  OCRLine,
  OCRParagraph,
  OCRWord,
} from "../types/ocr.types.ts";

export type {
  DatabaseStats,
  ImageRecord,
  OCRBBox,
  OCRBlock,
  OCRLayout,
  OCRLine,
  OCRParagraph,
  OCRWord,
  SearchResult,
};

export type ViewMode = "digital-doc" | "overlay" | "raw";
