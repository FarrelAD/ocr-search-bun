export interface OCRExtractResult {
  text: string;
  confidence: number;
  width: number | null;
  height: number | null;
}
