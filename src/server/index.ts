import fs from "node:fs/promises";
import path from "node:path";
import { initDb } from "../services/db.service.ts";
import type { ServerOptions } from "../types/server.types.ts";
import { createExpressApp } from "./app.ts";

export async function startServer(options?: ServerOptions) {
  if (options?.dbConfig) {
    await initDb(options.dbConfig);
  }
  const port = options?.port || 3000;
  const hostname = options?.host || "127.0.0.1";

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const app = createExpressApp();

  const server = app.listen(port, hostname, () => {
    console.log(`Server listening on http://${hostname}:${port}`);
  });

  (server as any).stop = (_force?: boolean) => {
    return new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return server;
}
