import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  closeDb,
  getDatabaseUrl,
  getDefaultConfig,
  getPrismaClient,
  initDb,
  parseDatabaseUrl,
  prisma,
} from "../src/services/db.service.ts";
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
    expect(record.ocr_text).toContain("ACME Corp Invoice");
    expect(record.confidence).toBeCloseTo(94.2, 1);
  });

  test("getImageByPath retrieves the inserted record", async () => {
    const record = await getImageByPath(testPath);
    expect(record).not.toBeNull();
    expect(record?.path).toBe(testPath);
  });

  test("getImageByHash retrieves inserted record", async () => {
    const record = await getImageByHash(testHash);
    expect(record).not.toBeNull();
    expect(record?.path).toBe(testPath);
  });

  test("upsertImage persists ocr_layout and getImageByPath parses it", async () => {
    const layoutObj = {
      blocks: [
        {
          text: "Total Due: $150.00",
          confidence: 95.0,
          bbox: { x0: 50, y0: 100, x1: 400, y1: 150 },
          paragraphs: [],
        },
      ],
      lines: [
        {
          text: "Total Due: $150.00",
          confidence: 95.0,
          bbox: { x0: 50, y0: 100, x1: 400, y1: 150 },
          words: [],
        },
      ],
      hocr: "<p>Total</p>",
    };

    const record = await upsertImage({
      path: testPath,
      hash: testHash,
      file_size: 2048,
      mtime: Date.now(),
      width: 1024,
      height: 768,
      ocr_text: "ACME Corp Invoice #98765 Total Due: $150.00",
      ocr_layout: JSON.stringify(layoutObj),
      confidence: 95.0,
    });

    expect(record.ocr_layout).toBeDefined();
    expect(record.layout).toEqual(layoutObj);

    const fetched = await getImageByPath(testPath);
    expect(fetched).not.toBeNull();
    expect(fetched?.ocr_layout).toContain("Total Due: $150.00");
    expect(fetched?.layout).toEqual(layoutObj);
    expect(fetched?.layout?.lines).toHaveLength(1);
    expect(fetched?.layout?.lines[0].text).toBe("Total Due: $150.00");
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
describe("Database Configuration Parsing", () => {
  test("parseDatabaseUrl parses valid MySQL URL string correctly", () => {
    const config = parseDatabaseUrl(
      "mysql://admin:secret@db.example.com:3307/custom_db",
    );
    expect(config).toEqual({
      host: "db.example.com",
      port: 3307,
      user: "admin",
      password: "secret",
      database: "custom_db",
      connectionLimit: 5,
    });
  });

  test("parseDatabaseUrl falls back on invalid URL", () => {
    const config = parseDatabaseUrl("invalid-url-string");
    expect(config).toEqual({
      host: "127.0.0.1",
      port: 3306,
      user: "root",
      password: "",
      database: "ocr_search",
      connectionLimit: 5,
    });
  });

  test("getDefaultConfig parses DATABASE_URL when no config object passed", () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL =
        "mysql://customuser:custompass@127.0.0.1:3306/customdb";
      const cfg = getDefaultConfig();
      expect(cfg.user).toBe("customuser");
      expect(cfg.password).toBe("custompass");
      expect(cfg.database).toBe("customdb");
      expect(cfg.connectionLimit).toBe(5);
    } finally {
      if (originalUrl !== undefined) {
        process.env.DATABASE_URL = originalUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    }
  });

  test("getDefaultConfig handles connectionLimit from config and environment variable", () => {
    const originalLimit = process.env.MYSQL_CONNECTION_LIMIT;
    try {
      // Default fallback
      delete process.env.MYSQL_CONNECTION_LIMIT;
      expect(getDefaultConfig().connectionLimit).toBe(5);

      // Custom config override
      expect(getDefaultConfig({ connectionLimit: 12 }).connectionLimit).toBe(
        12,
      );

      // Environment variable override
      process.env.MYSQL_CONNECTION_LIMIT = "20";
      expect(getDefaultConfig().connectionLimit).toBe(20);
    } finally {
      if (originalLimit !== undefined) {
        process.env.MYSQL_CONNECTION_LIMIT = originalLimit;
      } else {
        delete process.env.MYSQL_CONNECTION_LIMIT;
      }
    }
  });

  test("getDatabaseUrl prefers process.env.DATABASE_URL when config is not provided", () => {
    const originalUrl = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL =
        "mysql://testuser:testpass@localhost:3306/testdb";
      expect(getDatabaseUrl()).toBe(
        "mysql://testuser:testpass@localhost:3306/testdb",
      );
    } finally {
      if (originalUrl !== undefined) {
        process.env.DATABASE_URL = originalUrl;
      } else {
        delete process.env.DATABASE_URL;
      }
    }
  });
});

describe("Prisma Singleton & getPrismaClient", () => {
  test("getPrismaClient returns singleton instance without prior initDb call", () => {
    const client = getPrismaClient();
    expect(client).toBe(prisma);
  });
});
