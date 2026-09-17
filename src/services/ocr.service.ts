import fs from "node:fs/promises";
import { createWorker, type Worker } from "tesseract.js";
import type {
  OCRBBox,
  OCRBlock,
  OCRExtractResult,
  OCRLayout,
  OCRLine,
  OCRParagraph,
  OCRWord,
} from "../types/ocr.types.ts";
import { normalizePath } from "../utils/path.ts";

export function getImageDimensions(buf: Buffer): {
  width: number | null;
  height: number | null;
} {
  if (buf.length < 8) return { width: null, height: null };

  // PNG: \x89PNG\r\n\x1a\n
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    if (buf.length >= 24) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      return { width, height };
    }
  }

  // BMP: "BM"
  if (buf[0] === 0x42 && buf[1] === 0x4d) {
    if (buf.length >= 26) {
      const width = buf.readInt32LE(18);
      const height = Math.abs(buf.readInt32LE(22));
      return { width, height };
    }
  }

  // JPEG: Starts with 0xFFD8
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length - 8) {
      if (buf[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buf[offset + 1];
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        return { width, height };
      }
      const blockLength = buf.readUInt16BE(offset + 2);
      offset += 2 + blockLength;
    }
  }

  // WebP: Starts with "RIFF" and has "WEBP" at offset 8
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf.length >= 30 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    // VP8 chunk
    if (
      buf[12] === 0x56 &&
      buf[13] === 0x50 &&
      buf[14] === 0x38 &&
      buf[15] === 0x20
    ) {
      const width = buf.readUInt16LE(26) & 0x3fff;
      const height = buf.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }
    // VP8L chunk
    if (
      buf[12] === 0x56 &&
      buf[13] === 0x50 &&
      buf[14] === 0x38 &&
      buf[15] === 0x4c
    ) {
      const b0 = buf[21];
      const b1 = buf[22];
      const b2 = buf[23];
      const b3 = buf[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height };
    }
  }

  return { width: null, height: null };
}

export async function createOCRWorker(
  lang: string = process.env.OCR_LANG || "eng",
): Promise<Worker> {
  const worker = await createWorker(lang);
  return worker;
}

export async function terminateWorker(worker: Worker): Promise<void> {
  if (worker) {
    await worker.terminate();
  }
}
function normalizeBbox(bbox: any): OCRBBox {
  return {
    x0: typeof bbox?.x0 === "number" ? bbox.x0 : 0,
    y0: typeof bbox?.y0 === "number" ? bbox.y0 : 0,
    x1: typeof bbox?.x1 === "number" ? bbox.x1 : 0,
    y1: typeof bbox?.y1 === "number" ? bbox.y1 : 0,
  };
}

export function normalizeLayout(
  blocksData: any[] | null | undefined,
  hocr?: string,
): OCRLayout {
  const blocks: OCRBlock[] = [];
  const lines: OCRLine[] = [];

  if (Array.isArray(blocksData)) {
    for (const rawBlock of blocksData) {
      const paragraphs: OCRParagraph[] = [];
      const rawParagraphs = Array.isArray(rawBlock.paragraphs)
        ? rawBlock.paragraphs
        : [];

      for (const rawPara of rawParagraphs) {
        const paraLines: OCRLine[] = [];
        const rawLines = Array.isArray(rawPara.lines) ? rawPara.lines : [];

        for (const rawLine of rawLines) {
          const words: OCRWord[] = [];
          const rawWords = Array.isArray(rawLine.words) ? rawLine.words : [];

          for (const rawWord of rawWords) {
            words.push({
              text: typeof rawWord.text === "string" ? rawWord.text : "",
              confidence: Number(rawWord.confidence) || 0,
              bbox: normalizeBbox(rawWord.bbox),
            });
          }

          const lineObj: OCRLine = {
            text:
              typeof rawLine.text === "string" ? rawLine.text.trimEnd() : "",
            confidence: Number(rawLine.confidence) || 0,
            bbox: normalizeBbox(rawLine.bbox),
            words,
          };

          paraLines.push(lineObj);
          lines.push(lineObj);
        }

        paragraphs.push({
          text: typeof rawPara.text === "string" ? rawPara.text.trimEnd() : "",
          confidence: Number(rawPara.confidence) || 0,
          bbox: normalizeBbox(rawPara.bbox),
          lines: paraLines,
        });
      }

      blocks.push({
        text: typeof rawBlock.text === "string" ? rawBlock.text.trimEnd() : "",
        confidence: Number(rawBlock.confidence) || 0,
        bbox: normalizeBbox(rawBlock.bbox),
        blockType: rawBlock.blocktype ?? rawBlock.blockType,
        paragraphs,
      });
    }
  }

  return {
    blocks,
    lines,
    hocr: hocr || undefined,
  };
}

export async function extractText(
  imageInput: string | Buffer | Uint8Array,
  worker?: Worker,
  lang: string = process.env.OCR_LANG || "eng",
): Promise<OCRExtractResult> {
  let createdWorker = false;
  let activeWorker = worker;

  if (!activeWorker) {
    activeWorker = await createOCRWorker(lang);
    createdWorker = true;
  }

  try {
    let buffer: Buffer;
    if (typeof imageInput === "string") {
      const normalized = normalizePath(imageInput);
      buffer = await fs.readFile(normalized);
    } else if (Buffer.isBuffer(imageInput)) {
      buffer = imageInput;
    } else {
      buffer = Buffer.from(imageInput);
    }

    const dims = getImageDimensions(buffer);
    const recognition = await activeWorker.recognize(
      buffer,
      {},
      { text: true, hocr: true, blocks: true },
    );

    const text = recognition.data.text ? recognition.data.text.trim() : "";
    const confidence = recognition.data.confidence ?? 0;
    const hocr = recognition.data.hocr || "";
    const layout = normalizeLayout(recognition.data.blocks, hocr);

    return {
      text,
      confidence,
      width: dims.width,
      height: dims.height,
      layout,
      hocr,
    };
  } finally {
    if (createdWorker && activeWorker) {
      await activeWorker.terminate();
    }
  }
}
