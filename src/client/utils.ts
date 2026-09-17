import type { OCRLayout } from "./types.ts";

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function parseLayout(item: {
  layout?: OCRLayout | null;
  ocr_layout?: string | null;
}): OCRLayout | null {
  if (item.layout) return item.layout;
  if (item.ocr_layout) {
    try {
      return typeof item.ocr_layout === "string"
        ? JSON.parse(item.ocr_layout)
        : item.ocr_layout;
    } catch {
      return null;
    }
  }
  return null;
}
