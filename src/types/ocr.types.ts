export interface OCRBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: OCRBBox;
}

export interface OCRLine {
  text: string;
  confidence: number;
  bbox: OCRBBox;
  words: OCRWord[];
}

export interface OCRParagraph {
  text: string;
  confidence: number;
  bbox: OCRBBox;
  lines: OCRLine[];
}

export interface OCRBlock {
  text: string;
  confidence: number;
  bbox: OCRBBox;
  blockType?: string | number;
  paragraphs: OCRParagraph[];
}

export interface OCRLayout {
  blocks: OCRBlock[];
  lines: OCRLine[];
  hocr?: string;
}

export interface OCRExtractResult {
  text: string;
  confidence: number;
  width: number | null;
  height: number | null;
  layout?: OCRLayout;
  hocr?: string;
}
