import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import { startServer } from "../src/server/index.ts";
import { deleteImage, upsertImage } from "../src/services/image.service.ts";
import { normalizePath } from "../src/utils/path.ts";

describe("REST API & Server Integration Tests", () => {
  let server: any;
  const testPort = 3099;
  const testHost = "127.0.0.1";
  const baseUrl = `http://${testHost}:${testPort}`;
  const apiTestPath = "tests/fixtures/api_sample.png";

  beforeAll(async () => {
    await fs.mkdir(path.dirname(apiTestPath), { recursive: true });
    const samplePng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
      "base64",
    );
    await fs.writeFile(apiTestPath, samplePng);

    server = await startServer({ port: testPort, host: testHost });
    await upsertImage({
      path: normalizePath(apiTestPath),
      hash: "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
      file_size: 512,
      mtime: Date.now(),
      width: 400,
      height: 300,
      ocr_text: "API Test Receipt Total $42.00 Thank You",
      ocr_layout: JSON.stringify({
        blocks: [
          {
            text: "API Test Receipt Total $42.00",
            confidence: 98.0,
            bbox: { x0: 10, y0: 10, x1: 300, y1: 50 },
            paragraphs: [],
          },
        ],
        lines: [
          {
            text: "API Test Receipt Total $42.00",
            confidence: 98.0,
            bbox: { x0: 10, y0: 10, x1: 300, y1: 50 },
            words: [],
          },
        ],
        hocr: "<p>API Test Receipt</p>",
      }),
      confidence: 98.0,
    });
  });

  afterAll(async () => {
    await deleteImage(normalizePath(apiTestPath));
    await fs.rm(path.dirname(apiTestPath), { recursive: true, force: true });
    if (server) {
      await server.stop(true);
    }
  });

  test("GET /api/stats returns database statistics JSON", async () => {
    const res = await fetch(`${baseUrl}/api/stats`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.totalImages).toBe("number");
    expect(typeof data.avgConfidence).toBe("number");
  });

  test("GET /api/search returns search results array", async () => {
    const res = await fetch(`${baseUrl}/api/search?q=Receipt`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].snippet).toContain("<mark>");
    expect(data[0].ocr_layout).toBeDefined();
    expect(data[0].layout).toBeDefined();
    expect(data[0].layout.lines).toHaveLength(1);
  });

  test("GET /api/images returns paginated images list", async () => {
    const res = await fetch(`${baseUrl}/api/images?limit=10`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.images)).toBe(true);
    expect(typeof data.total).toBe("number");
    const sample = data.images.find(
      (img: any) => img.path === normalizePath(apiTestPath),
    );
    expect(sample).toBeDefined();
    expect(sample.ocr_layout).toBeDefined();
    expect(sample.layout).toBeDefined();
  });

  test("GET /index.html serves static HTML dashboard", async () => {
    const res = await fetch(`${baseUrl}/index.html`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("OCR Image Search");
  });

  test("POST /api/scan accepts lang parameter in JSON body", async () => {
    const res = await fetch(`${baseUrl}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: apiTestPath,
        force: true,
        lang: "eng",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.scanResult.totalScanned).toBe(1);
    expect(data.scanResult.layout).toBeDefined();
    expect(data.layout).toBeDefined();
    expect(typeof data.hocr).toBe("string");
  });

  test("POST /api/scan accepts lang parameter in query string", async () => {
    const res = await fetch(`${baseUrl}/api/scan?lang=eng`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: apiTestPath,
        force: true,
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.scanResult.totalScanned).toBe(1);
  });

  test("POST /api/scan accepts lang parameter in multipart/form-data upload", async () => {
    const sampleBuffer = await fs.readFile(apiTestPath);
    const blob = new Blob([sampleBuffer], { type: "image/png" });
    const formData = new FormData();
    formData.append("lang", "eng");
    formData.append("file", blob, "test_upload.png");

    const res = await fetch(`${baseUrl}/api/scan`, {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.scanResult.totalScanned).toBe(1);
  });

  test("GET /api/image-file returns image with Cache-Control header", async () => {
    const res = await fetch(
      `${baseUrl}/api/image-file?path=${encodeURIComponent(apiTestPath)}`,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=86400");
    const bytes = await res.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  test("GET /api/image-file returns 404 for nonexistent path", async () => {
    const res = await fetch(
      `${baseUrl}/api/image-file?path=nonexistent_file.png`,
    );
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  test("GET /api/unknown-route returns 404 JSON Not Found", async () => {
    const res = await fetch(`${baseUrl}/api/unknown-route`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data).toEqual({ error: "Not Found" });
  });

  test("GET / serves static index.html", async () => {
    const res = await fetch(`${baseUrl}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("OCR Image Search");
  });

  test("DELETE /api/image-file deletes image from database", async () => {
    const res = await fetch(
      `${baseUrl}/api/image-file?path=${encodeURIComponent(apiTestPath)}`,
      { method: "DELETE" },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.path).toBe(normalizePath(apiTestPath));
  });
});
