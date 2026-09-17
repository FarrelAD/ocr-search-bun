import type mysql from "mysql2/promise";
import { searchImages } from "./db.service.ts";
import type { SearchResult } from "../types/db.types.ts";
import type { FormattedSearchResult } from "../types/search.types.ts";
export function formatFtsQuery(rawQuery: string): string {
  if (!rawQuery) return "";
  const trimmed = rawQuery.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length > 2) {
    const phrase = trimmed.slice(1, -1).replace(/["+\-*<>~()@]/g, " ").trim();
    return phrase ? `"${phrase}"` : "";
  }

  const words = trimmed
    .replace(/["+\-*<>~()@]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return "";
  return words.map((w) => `+${w}*`).join(" ");
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function generateSnippet(
  fullText: string,
  query: string,
  maxLength: number = 150
): string {
  if (!fullText) return "";

  const terms = query
    .replace(/["+\-*<>~()@]/g, " ")
    .split(/\s+/)
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 0);

  if (terms.length === 0) {
    const snippetRaw = fullText.slice(0, maxLength);
    const suffix = fullText.length > maxLength ? "..." : "";
    return escapeHtml(snippetRaw) + suffix;
  }

  const lowerText = fullText.toLowerCase();
  let firstIdx = -1;

  for (const term of terms) {
    const idx = lowerText.indexOf(term);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  let start = 0;
  let end = fullText.length;
  let prefix = "";
  let suffix = "";

  if (firstIdx !== -1) {
    const half = Math.floor((maxLength - 30) / 2);
    start = Math.max(0, firstIdx - half);
    end = Math.min(fullText.length, start + maxLength);
    if (start > 0) prefix = "...";
    if (end < fullText.length) suffix = "...";
  } else {
    end = Math.min(fullText.length, maxLength);
    if (end < fullText.length) suffix = "...";
  }

  const rawSnippet = fullText.substring(start, end);
  let escaped = escapeHtml(rawSnippet);

  // Highlight terms
  const escapedTerms = terms
    .map((t) => escapeHtml(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .filter((t) => t.length > 0);

  if (escapedTerms.length > 0) {
    const pattern = new RegExp(`(${escapedTerms.join("|")})`, "gi");
    escaped = escaped.replace(pattern, "<mark>$1</mark>");
  }

  return prefix + escaped + suffix;
}

export async function executeSearch(
  query: string,
  options?: { limit?: number; offset?: number },
  dbPool?: mysql.Pool
): Promise<FormattedSearchResult[]> {
  const formatted = formatFtsQuery(query);
  if (!formatted) return [];

  const rawResults = await searchImages(formatted, options, dbPool);

  return rawResults.map((item) => ({
    ...item,
    snippet: generateSnippet(item.ocr_text, query, 150),
  }));
}
