import path from "node:path";
import fs from "node:fs/promises";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { initDb, getStats, getAllImages, deleteImage, type MySQLConfig } from "./db.ts";
import { scanPath } from "./scanner.ts";
import { executeSearch } from "./search.ts";
import { normalizePath } from "./ocr.ts";

export interface ServerOptions {
  port?: number;
  host?: string;
  dbConfig?: MySQLConfig;
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".json": "application/json; charset=utf-8",
};

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

export function createExpressApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(process.cwd(), "public")));

  const uploadsDir = path.join(process.cwd(), "uploads");
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
  });
  const upload = multer({ storage });

  // GET /api/stats
  app.get("/api/stats", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await getStats();
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/search
  app.get("/api/search", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q : "";
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;

      if (!q.trim()) {
        return res.json([]);
      }

      const results = await executeSearch(q, { limit, offset });
      res.json(results);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/images
  app.get("/api/images", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const data = await getAllImages({ limit, offset });
      res.json(data);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/scan
  app.post(
    "/api/scan",
    upload.fields([{ name: "file", maxCount: 1 }, { name: "image", maxCount: 1 }]),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const contentType = req.headers["content-type"] || "";

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        const uploadedFile = files?.file?.[0] || files?.image?.[0];

        if (uploadedFile) {
          const savePath = normalizePath(uploadedFile.path);
          const scanResult = await scanPath(savePath, { force: true });
          return res.json({ success: true, path: savePath, scanResult });
        }

        if (contentType.includes("multipart/form-data")) {
          return res.status(400).json({
            error: "No image file uploaded in form field 'file' or 'image'.",
          });
        }

        if (contentType.includes("application/json") || req.body?.path) {
          const body = req.body as { path?: string; force?: boolean };
          if (!body?.path) {
            return res.status(400).json({ error: "Missing 'path' parameter in JSON body." });
          }

          const normPath = normalizePath(body.path);
          const scanResult = await scanPath(normPath, { force: Boolean(body.force) });
          return res.json({ success: true, path: normPath, scanResult });
        }

        return res.status(400).json({
          error: "Unsupported Content-Type. Use multipart/form-data or application/json.",
        });
      } catch (err) {
        next(err);
      }
    }
  );

  // GET /api/image-file
  app.get("/api/image-file", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imgPath = typeof req.query.path === "string" ? req.query.path : undefined;
      if (!imgPath) {
        return res.status(400).json({ error: "Missing 'path' query parameter." });
      }

      const normalized = normalizePath(imgPath);
      const resolvedPath = path.resolve(normalized);

      try {
        await fs.access(resolvedPath);
      } catch {
        return res.status(404).json({ error: `File not found at path: ${normalized}` });
      }

      res.setHeader("Cache-Control", "public, max-age=86400");
      res.sendFile(resolvedPath, (err) => {
        if (err && !res.headersSent) {
          res.status(404).json({ error: `File not found at path: ${normalized}` });
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /api/image-file
  app.delete("/api/image-file", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imgPath = typeof req.query.path === "string" ? req.query.path : undefined;
      if (!imgPath) {
        return res.status(400).json({ error: "Missing 'path' query parameter." });
      }

      const normalized = normalizePath(imgPath);
      const deleted = await deleteImage(normalized);
      res.json({ success: deleted, path: normalized });
    } catch (err) {
      next(err);
    }
  });

  // Catch-all 404 for unmatched /api/* routes
  app.all("/api/*", (req: Request, res: Response) => {
    res.status(404).json({ error: "Not Found" });
  });

  // Global error middleware
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errMsg });
  });

  return app;
}

export async function startServer(options?: ServerOptions) {
  await initDb(options?.dbConfig);

  const port = options?.port || 3000;
  const hostname = options?.host || "127.0.0.1";

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const app = createExpressApp();

  const server = app.listen(port, hostname, () => {
    console.log(`Server listening on http://${hostname}:${port}`);
  });

  (server as any).stop = (force?: boolean) => {
    return new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  };

  return server;
}
