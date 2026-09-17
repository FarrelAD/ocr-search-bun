import { defineConfig } from "@prisma/config";

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const port = process.env.MYSQL_PORT || "3306";
  const user = process.env.MYSQL_USER || "root";
  const pass = process.env.MYSQL_PASSWORD ? `:${encodeURIComponent(process.env.MYSQL_PASSWORD)}` : "";
  const db = process.env.MYSQL_DATABASE || "ocr_search";
  return `mysql://${user}${pass}@${host}:${port}/${db}`;
}

export default defineConfig({
  datasource: {
    url: getDatabaseUrl(),
  },
});
