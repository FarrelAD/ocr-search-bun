import path from "node:path";

export function normalizePath(filePath: string): string {
  return path.normalize(filePath).replaceAll("\\", "/");
}
