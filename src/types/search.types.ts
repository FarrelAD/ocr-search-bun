import type { SearchResult } from "./db.types.ts";

export interface FormattedSearchResult extends SearchResult {
  snippet: string;
}
