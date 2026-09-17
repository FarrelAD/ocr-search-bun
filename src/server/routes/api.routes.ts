import path from "node:path";
import {
  deleteImage,
  getAllImages,
  getImageByPath,
  getStats,
} from "../../services/image.service.ts";
import { scanPath } from "../../services/scanner.service.ts";
import { executeSearch } from "../../services/search.service.ts";
import type { RouteTarget } from "../../types/index.ts";
import { normalizePath } from "../../utils/path.ts";

export function createApiRoutes(
  uploadsDir: string,
): Record<string, RouteTarget> {
  return {
    "/api/stats": {
      GET: async () => {
        const stats = await getStats();
        return Response.json(stats);
      },
    },

    "/api/search": {
      GET: async (req: Request) => {
        const url = new URL(req.url);
        const q = url.searchParams.get("q") ?? "";
        const limit = Number(url.searchParams.get("limit")) || 20;
        const offset = Number(url.searchParams.get("offset")) || 0;

        if (!q.trim()) {
          return Response.json([]);
        }

        const results = await executeSearch(q, { limit, offset });
        return Response.json(results);
      },
    },

    "/api/images": {
      GET: async (req: Request) => {
        const url = new URL(req.url);
        const limit = Number(url.searchParams.get("limit")) || 20;
        const offset = Number(url.searchParams.get("offset")) || 0;
        const data = await getAllImages({ limit, offset });
        return Response.json(data);
      },
    },

    "/api/scan": {
      POST: async (req: Request) => {
        const url = new URL(req.url);
        const contentType = req.headers.get("content-type") || "";
        const queryLang = url.searchParams.get("lang") || undefined;

        if (contentType.includes("multipart/form-data")) {
          const formData = await req.formData();
          const formLang = formData.get("lang");
          const lang =
            (typeof formLang === "string" && formLang.trim()
              ? formLang
              : queryLang) || undefined;

          const fileEntry = formData.get("file") || formData.get("image");
          if (fileEntry && fileEntry instanceof File && fileEntry.size > 0) {
            const filename = `${Date.now()}_${fileEntry.name}`;
            const savePath = normalizePath(path.join(uploadsDir, filename));
            await Bun.write(savePath, fileEntry);

            const scanResult = await scanPath(savePath, { force: true, lang });
            const record = await getImageByPath(savePath);
            const fullScanResult = {
              ...scanResult,
              layout: record?.layout ?? null,
              hocr: record?.layout?.hocr ?? null,
            };
            return Response.json({
              success: true,
              path: savePath,
              scanResult: fullScanResult,
              layout: record?.layout ?? null,
              hocr: record?.layout?.hocr ?? null,
              image: record ?? null,
            });
          }

          return Response.json(
            {
              error: "No image file uploaded in form field 'file' or 'image'.",
            },
            { status: 400 },
          );
        }

        if (contentType.includes("application/json")) {
          const body = (await req.json().catch(() => ({}))) as {
            path?: string;
            force?: boolean;
            lang?: string;
          };
          const lang = body.lang ?? queryLang;

          if (!body?.path) {
            return Response.json(
              { error: "Missing 'path' parameter in JSON body." },
              { status: 400 },
            );
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
          return Response.json({
            success: true,
            path: normPath,
            scanResult: fullScanResult,
            layout: record?.layout ?? null,
            hocr: record?.layout?.hocr ?? null,
            image: record ?? null,
          });
        }

        return Response.json(
          {
            error:
              "Unsupported Content-Type. Use multipart/form-data or application/json.",
          },
          { status: 400 },
        );
      },
    },

    "/api/image-file": {
      GET: async (req: Request) => {
        const url = new URL(req.url);
        const imgPath = url.searchParams.get("path") || undefined;
        if (!imgPath) {
          return Response.json(
            { error: "Missing 'path' query parameter." },
            { status: 400 },
          );
        }

        const normalized = normalizePath(imgPath);
        const resolvedPath = path.resolve(normalized);
        const file = Bun.file(resolvedPath);

        if (!(await file.exists())) {
          return Response.json(
            { error: `File not found at path: ${normalized}` },
            { status: 404 },
          );
        }

        return new Response(file, {
          headers: { "Cache-Control": "public, max-age=86400" },
        });
      },
      DELETE: async (req: Request) => {
        const url = new URL(req.url);
        const imgPath = url.searchParams.get("path") || undefined;
        if (!imgPath) {
          return Response.json(
            { error: "Missing 'path' query parameter." },
            { status: 400 },
          );
        }

        const normalized = normalizePath(imgPath);
        const deleted = await deleteImage(normalized);
        return Response.json({ success: deleted, path: normalized });
      },
    },

    "/api/*": () => Response.json({ error: "Not Found" }, { status: 404 }),
  };
}
