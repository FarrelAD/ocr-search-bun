import type { MySQLConfig } from "./db.types.ts";

export interface ServerOptions {
  port?: number;
  host?: string;
  dbConfig?: MySQLConfig;
}
