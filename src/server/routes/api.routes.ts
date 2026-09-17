import fs from "node:fs/promises";
import path from "node:path";
import {
  type NextFunction,
  type Request,
  type Response,
  Router,
} from "express";
import {
  deleteImage,
  getAllImages,
  getImageByPath,
  getStats,
} from "../../services/image.service.ts";
import { scanPath } from "../../services/scanner.service.ts";
import { executeSearch } from "../../services/search.service.ts";
import { normalizePath } from "../../utils/path.ts";
import { uploadImageMiddleware } from "../middleware/upload.middleware.ts";

export const apiRouter = Router();

// GET /api/stats -> /stats
apiRouter.get(
  "/stats",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await getStats();
      res.json(stats);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/search -> /search
apiRouter.get(
  "/search",
  async (req: Request, res: Response, next: NextFunction) => {
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
  },
);

// GET /api/images -> /images
apiRouter.get(
  "/images",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Number(req.query.limit) || 20;
      const offset = Number(req.query.offset) || 0;
      const data = await getAllImages({ limit, offset });
      res.json(data);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/scan -> /scan
apiRouter.post(
  "/scan",
  uploadImageMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contentType = req.headers["content-type"] || "";
      const rawLang = req.body?.lang ?? req.query?.lang;
      const lang = typeof rawLang === "string" ? rawLang : undefined;

      const files = req.files as
        | { [fieldname: string]: Express.Multer.File[] }
        | undefined;
      const uploadedFile = files?.file?.[0] || files?.image?.[0];

      if (uploadedFile) {
        const savePath = normalizePath(uploadedFile.path);
        const scanResult = await scanPath(savePath, { force: true, lang });
        const record = await getImageByPath(savePath);
        const fullScanResult = {
          ...scanResult,
          layout: record?.layout ?? null,
          hocr: record?.layout?.hocr ?? null,
        };
        return res.json({
          success: true,
          path: savePath,
          scanResult: fullScanResult,
          layout: record?.layout ?? null,
          hocr: record?.layout?.hocr ?? null,
          image: record ?? null,
        });
      }

      if (contentType.includes("multipart/form-data")) {
        return res.status(400).json({
          error: "No image file uploaded in form field 'file' or 'image'.",
        });
      }

      if (contentType.includes("application/json") || req.body?.path) {
        const body = req.body as {
          path?: string;
          force?: boolean;
          lang?: string;
        };
        if (!body?.path) {
          return res
            .status(400)
            .json({ error: "Missing 'path' parameter in JSON body." });
        }

        const normPath = normalizePath(body.path);
        const scanResult = await scanPath(normPath, {
          force: Boolean(body.force),
          lang,
        });
        const record = await getImageByPath(normPath);
        const fullScanResult = {
          ...scanResult,
          layout: record?.layout ?? null,
          hocr: record?.layout?.hocr ?? null,
        };
        return res.json({
          success: true,
          path: normPath,
          scanResult: fullScanResult,
          layout: record?.layout ?? null,
          hocr: record?.layout?.hocr ?? null,
          image: record ?? null,
        });
      }
      return res.status(400).json({
        error:
          "Unsupported Content-Type. Use multipart/form-data or application/json.",
      });
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/image-file -> /image-file
apiRouter.get(
  "/image-file",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imgPath =
        typeof req.query.path === "string" ? req.query.path : undefined;
      if (!imgPath) {
        return res
          .status(400)
          .json({ error: "Missing 'path' query parameter." });
      }

      const normalized = normalizePath(imgPath);
      const resolvedPath = path.resolve(normalized);

      try {
        await fs.access(resolvedPath);
      } catch {
        return res
          .status(404)
          .json({ error: `File not found at path: ${normalized}` });
      }

      res.setHeader("Cache-Control", "public, max-age=86400");
      res.sendFile(resolvedPath, (err) => {
        if (err && !res.headersSent) {
          res
            .status(404)
            .json({ error: `File not found at path: ${normalized}` });
        }
      });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /api/image-file -> /image-file
apiRouter.delete(
  "/image-file",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imgPath =
        typeof req.query.path === "string" ? req.query.path : undefined;
      if (!imgPath) {
        return res
          .status(400)
          .json({ error: "Missing 'path' query parameter." });
      }

      const normalized = normalizePath(imgPath);
      const deleted = await deleteImage(normalized);
      res.json({ success: deleted, path: normalized });
    } catch (err) {
      next(err);
    }
  },
);

// Catch-all 404 for unmatched /api/* routes
apiRouter.all("/*", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not Found" });
});
