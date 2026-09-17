import { describe, expect, test } from "bun:test";
import { getImageDimensions, normalizePath, extractText } from "../src/ocr.ts";
import { isSupportedImage, computeSha256 } from "../src/scanner.ts";

describe("OCR & Image Utility Tests", () => {
  test("normalizePath converts backslashes to forward slashes", () => {
    expect(normalizePath("C:\\Users\\test\\image.PNG")).toBe("C:/Users/test/image.PNG");
  });

  test("isSupportedImage correctly identifies image extensions", () => {
    expect(isSupportedImage("test.png")).toBe(true);
    expect(isSupportedImage("test.JPG")).toBe(true);
    expect(isSupportedImage("test.webp")).toBe(true);
    expect(isSupportedImage("test.txt")).toBe(false);
    expect(isSupportedImage("test.pdf")).toBe(false);
  });

  test("getImageDimensions parses PNG header dimensions", () => {
    const samplePng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
      "base64"
    );
    const dims = getImageDimensions(samplePng);
    expect(dims).toEqual({ width: 1, height: 1 });
  });

  test("computeSha256 produces valid 64-character hash", async () => {
    const buf = Buffer.from("hello world");
    const hash = await computeSha256(buf);
    expect(hash).toHaveLength(64);
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
  });

  test("extractText processes 1x1 image buffer cleanly", async () => {
    const samplePng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
      "base64"
    );
    const result = await extractText(samplePng);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(typeof result.confidence).toBe("number");
    expect(typeof result.text).toBe("string");
  });
});
