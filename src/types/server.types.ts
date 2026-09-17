import type { MySQLConfig } from "./db.types.ts";

export interface ServerOptions {
  port?: number;
  host?: string;
  dbConfig?: MySQLConfig;
}

export type RouteHandler = (req: Request) => Promise<Response> | Response;

export type RouteTarget =
  | RouteHandler
  | { [method: string]: RouteHandler }
  | { dir: string }
  | Response;

export interface AppOptions {
  extraRoutes?: Record<string, RouteTarget>;
  publicDir?: string;
  uploadsDir?: string;
}
