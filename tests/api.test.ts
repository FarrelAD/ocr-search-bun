import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startServer } from "../src/server/index.ts";
import { deleteImage, upsertImage } from "../src/services/image.service.ts";

describe("REST API & Server Integration Tests", () => {
  let server: any;
  const testPort = 3099;
  const testHost = "127.0.0.1";
  const baseUrl = `http://${testHost}:${testPort}`;
  const apiTestPath = "tests/fixtures/api_sample.png";

  beforeAll(async () => {
    server = await startServer({ port: testPort, host: testHost });
    await upsertImage({
      path: apiTestPath,
      hash: "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
      file_size: 512,
      mtime: Date.now(),
      width: 400,
      height: 300,
      ocr_text: "API Test Receipt Total $42.00 Thank You",
      confidence: 98.0,
    });
  });

  afterAll(async () => {
    await deleteImage(apiTestPath);
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
  });

  test("GET /api/images returns paginated images list", async () => {
    const res = await fetch(`${baseUrl}/api/images?limit=10`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.images)).toBe(true);
    expect(typeof data.total).toBe("number");
  });

  test("GET /index.html serves static HTML dashboard", async () => {
    const res = await fetch(`${baseUrl}/index.html`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("OCR Image Search");
  });
});
