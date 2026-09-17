import { describe, expect, test } from "bun:test";
import {
  extractText,
  getImageDimensions,
  normalizeLayout,
} from "../src/services/ocr.service.ts";
import {
  computeSha256,
  isSupportedImage,
} from "../src/services/scanner.service.ts";
import { normalizePath } from "../src/utils/path.ts";

describe("OCR & Image Utility Tests", () => {
  test("normalizePath converts backslashes to forward slashes", () => {
    expect(normalizePath("C:\\Users\\test\\image.PNG")).toBe(
      "C:/Users/test/image.PNG",
    );
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
      "base64",
    );
    const dims = getImageDimensions(samplePng);
    expect(dims).toEqual({ width: 1, height: 1 });
  });

  test("computeSha256 produces valid 64-character hash", async () => {
    const buf = Buffer.from("hello world");
    const hash = await computeSha256(buf);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  test("extractText processes 1x1 image buffer cleanly", async () => {
    const samplePng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
      "base64",
    );
    const result = await extractText(samplePng);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(typeof result.confidence).toBe("number");
    expect(typeof result.text).toBe("string");
    expect(result.layout).toBeDefined();
    expect(Array.isArray(result.layout?.blocks)).toBe(true);
    expect(Array.isArray(result.layout?.lines)).toBe(true);
    expect(typeof result.hocr).toBe("string");
  });

  test("normalizeLayout accurately computes hierarchical layout coordinates", () => {
    const mockBlocks = [
      {
        text: "Invoice #12345\n",
        confidence: 95.5,
        bbox: { x0: 20, y0: 30, x1: 300, y1: 70 },
        blocktype: "1",
        paragraphs: [
          {
            text: "Invoice #12345\n",
            confidence: 96.0,
            bbox: { x0: 20, y0: 30, x1: 300, y1: 70 },
            lines: [
              {
                text: "Invoice #12345",
                confidence: 96.0,
                bbox: { x0: 20, y0: 30, x1: 300, y1: 70 },
                words: [
                  {
                    text: "Invoice",
                    confidence: 98.0,
                    bbox: { x0: 20, y0: 30, x1: 140, y1: 70 },
                  },
                  {
                    text: "#12345",
                    confidence: 94.0,
                    bbox: { x0: 150, y0: 30, x1: 300, y1: 70 },
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const layout = normalizeLayout(
      mockBlocks,
      "<div class='ocr_page'>hOCR</div>",
    );
    expect(layout.blocks).toHaveLength(1);
    expect(layout.lines).toHaveLength(1);
    expect(layout.hocr).toBe("<div class='ocr_page'>hOCR</div>");

    const block = layout.blocks[0];
    expect(block.text).toBe("Invoice #12345");
    expect(block.bbox).toEqual({ x0: 20, y0: 30, x1: 300, y1: 70 });
    expect(block.paragraphs).toHaveLength(1);

    const line = layout.lines[0];
    expect(line.text).toBe("Invoice #12345");
    expect(line.words).toHaveLength(2);
    expect(line.words[0].text).toBe("Invoice");
    expect(line.words[0].bbox).toEqual({ x0: 20, y0: 30, x1: 140, y1: 70 });
    expect(line.words[1].text).toBe("#12345");
    expect(line.words[1].bbox).toEqual({ x0: 150, y0: 30, x1: 300, y1: 70 });
  });
});
