import path from "node:path";
import fs from "node:fs/promises";
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

export async function handleApiRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  try {
    if (pathname === "/api/stats" && method === "GET") {
      const stats = await getStats();
      return Response.json(stats);
    }

    if (pathname === "/api/search" && method === "GET") {
      const q = url.searchParams.get("q") || "";
      const limit = Number(url.searchParams.get("limit")) || 20;
      const offset = Number(url.searchParams.get("offset")) || 0;

      if (!q.trim()) {
        return Response.json([]);
      }

      const results = await executeSearch(q, { limit, offset });
      return Response.json(results);
    }

    if (pathname === "/api/images" && method === "GET") {
      const limit = Number(url.searchParams.get("limit")) || 20;
      const offset = Number(url.searchParams.get("offset")) || 0;
      const data = await getAllImages({ limit, offset });
      return Response.json(data);
    }

    if (pathname === "/api/scan" && method === "POST") {
      const contentType = req.headers.get("content-type") || "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file") || formData.get("image");

        if (!file || typeof file === "string") {
          return Response.json(
            { error: "No image file uploaded in form field 'file' or 'image'." },
            { status: 400 }
          );
        }

        const uploadsDir = path.join(process.cwd(), "uploads");
        await fs.mkdir(uploadsDir, { recursive: true });

        const blob = file as Blob & { name?: string };
        const originalName = blob.name || `upload_${Date.now()}.png`;
        const savePath = normalizePath(path.join(uploadsDir, `${Date.now()}_${originalName}`));

        const arrayBuffer = await blob.arrayBuffer();
        await fs.writeFile(savePath, Buffer.from(arrayBuffer));

        const scanResult = await scanPath(savePath, { force: true });
        return Response.json({ success: true, path: savePath, scanResult });
      }

      if (contentType.includes("application/json")) {
        const body = (await req.json()) as { path?: string; force?: boolean };
        if (!body.path) {
          return Response.json({ error: "Missing 'path' parameter in JSON body." }, { status: 400 });
        }

        const normPath = normalizePath(body.path);
        const scanResult = await scanPath(normPath, { force: Boolean(body.force) });
        return Response.json({ success: true, path: normPath, scanResult });
      }

      return Response.json(
        { error: "Unsupported Content-Type. Use multipart/form-data or application/json." },
        { status: 400 }
      );
    }

    if (pathname === "/api/image-file" && method === "GET") {
      const imgPath = url.searchParams.get("path");
      if (!imgPath) {
        return Response.json({ error: "Missing 'path' query parameter." }, { status: 400 });
      }

      const normalized = normalizePath(imgPath);
      try {
        const fileContent = await fs.readFile(normalized);
        const mime = getMimeType(normalized);
        return new Response(fileContent, {
          headers: {
            "Content-Type": mime,
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch {
        return Response.json({ error: `File not found at path: ${normalized}` }, { status: 404 });
      }
    }

    if (pathname === "/api/image-file" && method === "DELETE") {
      const imgPath = url.searchParams.get("path");
      if (!imgPath) {
        return Response.json({ error: "Missing 'path' query parameter." }, { status: 400 });
      }

      const normalized = normalizePath(imgPath);
      const deleted = await deleteImage(normalized);
      return Response.json({ success: deleted, path: normalized });
    }

    return Response.json({ error: "Not Found" }, { status: 404 });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}

export async function handleStaticRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let pathname = url.pathname;

  if (pathname === "/") {
    pathname = "/index.html";
  }

  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, "");
  const publicDir = path.join(process.cwd(), "public");
  const fullPath = path.join(publicDir, safePath);

  try {
    const fileContent = await fs.readFile(fullPath);
    const mime = getMimeType(fullPath);
    return new Response(fileContent, {
      headers: { "Content-Type": mime },
    });
  } catch {
    return Response.json({ error: "Static file not found" }, { status: 404 });
  }
}

export async function startServer(options?: ServerOptions) {
  await initDb(options?.dbConfig);

  const port = options?.port || 3000;
  const hostname = options?.host || "127.0.0.1";

  const uploadsDir = path.join(process.cwd(), "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const server = Bun.serve({
    port,
    hostname,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname.startsWith("/api/")) {
        return handleApiRequest(req);
      }
      return handleStaticRequest(req);
    },
  });

  console.log(`Server listening on http://${server.hostname}:${server.port}`);
  return server;
}
