import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { closeDb, initDb } from "../src/services/db.service.ts";
import {
  deleteImage,
  getImageByHash,
  getImageByPath,
  getStats,
  searchImages,
  upsertImage,
} from "../src/services/image.service.ts";

describe("Database Layer Tests", () => {
  const testPath = "tests/fixtures/sample_invoice.png";
  const testHash =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

  beforeAll(async () => {
    await initDb();
    await deleteImage(testPath);
  });

  afterAll(async () => {
    await deleteImage(testPath);
    await closeDb();
  });

  test("upsertImage inserts a new image record", async () => {
    const record = await upsertImage({
      path: testPath,
      hash: testHash,
      file_size: 2048,
      mtime: Date.now(),
      width: 1024,
      height: 768,
      ocr_text: "ACME Corp Invoice #98765 Total Due: $150.00",
      confidence: 94.2,
    });

    expect(record).toBeDefined();
    expect(record.path).toBe(testPath);
    expect(record.confidence).toBeCloseTo(94.2, 1);
  });

  test("getImageByPath retrieves inserted record", async () => {
    const record = await getImageByPath(testPath);
    expect(record).not.toBeNull();
    expect(record?.hash).toBe(testHash);
  });

  test("getImageByHash retrieves inserted record", async () => {
    const record = await getImageByHash(testHash);
    expect(record).not.toBeNull();
    expect(record?.path).toBe(testPath);
  });

  test("searchImages finds image by FULLTEXT index match", async () => {
    const results = await searchImages("+ACME* +Invoice*");
    expect(results.length).toBeGreaterThan(0);
    const match = results.find((r) => r.path === testPath);
    expect(match).toBeDefined();
    expect(match?.ocr_text).toContain("Invoice #98765");
  });

  test("getStats returns non-zero counts and metrics", async () => {
    const stats = await getStats();
    expect(stats.totalImages).toBeGreaterThan(0);
    expect(stats.totalTextBytes).toBeGreaterThan(0);
    expect(stats.avgConfidence).toBeGreaterThan(0);
  });

  test("deleteImage removes record cleanly", async () => {
    const deleted = await deleteImage(testPath);
    expect(deleted).toBe(true);
    const record = await getImageByPath(testPath);
    expect(record).toBeNull();
  });
});
