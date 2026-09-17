import type React from "react";
import { useEffect, useState } from "react";
import type { ImageRecord, SearchResult, ViewMode } from "../types.ts";
import { formatBytes, parseLayout } from "../utils.ts";

interface DocumentModalProps {
  item: ImageRecord | SearchResult | null;
  onClose: () => void;
}

export const DocumentModal: React.FC<DocumentModalProps> = ({
  item,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("digital-doc");
  const [zoom, setZoom] = useState<number>(100);
  const [copyStatus, setCopyStatus] = useState<string>("");

  useEffect(() => {
    if (!item) return;

    const layout = parseLayout(item);
    const hasLayout =
      layout &&
      ((Array.isArray(layout.lines) && layout.lines.length > 0) ||
        (Array.isArray(layout.blocks) && layout.blocks.length > 0));

    // Default to digital-doc if layout is present, otherwise raw
    if (hasLayout && item.width && item.height) {
      setViewMode("digital-doc");
    } else {
      setViewMode("raw");
    }
    setZoom(100);
    setCopyStatus("");
  }, [item]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && item) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const layout = parseLayout(item);
  const hasLayout =
    layout &&
    ((Array.isArray(layout.lines) && layout.lines.length > 0) ||
      (Array.isArray(layout.blocks) && layout.blocks.length > 0));

  const filename = item.path.split("/").pop() || "Image Details";
  const imgUrl = `/api/image-file?path=${encodeURIComponent(item.path)}`;
  const lines = layout?.lines || [];
  const blocks = layout?.blocks || [];
  const w = item.width || 800;
  const h = item.height || 1000;

  const handleCopyStructured = () => {
    let textToCopy = "";
    if (blocks.length > 0) {
      const blockTexts: string[] = [];
      for (const block of blocks) {
        const paraTexts: string[] = [];
        for (const para of block.paragraphs || []) {
          const lineTexts = (para.lines || [])
            .map((l) => l.text)
            .filter(Boolean);
          if (lineTexts.length > 0) {
            paraTexts.push(lineTexts.join("\n"));
          }
        }
        if (paraTexts.length > 0) {
          blockTexts.push(paraTexts.join("\n\n"));
        } else if (block.text) {
          blockTexts.push(block.text);
        }
      }
      if (blockTexts.length > 0) {
        textToCopy = blockTexts.join("\n\n---\n\n");
      }
    }

    if (!textToCopy && lines.length > 0) {
      textToCopy = lines.map((l) => l.text).join("\n");
    }

    if (!textToCopy) {
      textToCopy = item.ocr_text || "";
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyStatus("Copied!");
      setTimeout(() => setCopyStatus(""), 2000);
    });
  };

  const handleCopyRaw = () => {
    navigator.clipboard.writeText(item.ocr_text || "").then(() => {
      setCopyStatus("Raw Copied!");
      setTimeout(() => setCopyStatus(""), 2000);
    });
  };

  const handleExportHtml = () => {
    const fileName = `${filename.replace(/\.[^/.]+$/, "")}-layout.html`;
    const linesHtml = lines
      .map((line) => {
        const left = ((line.bbox.x0 / w) * 100).toFixed(3);
        const top = ((line.bbox.y0 / h) * 100).toFixed(3);
        const width = (((line.bbox.x1 - line.bbox.x0) / w) * 100).toFixed(3);
        const height = (((line.bbox.y1 - line.bbox.y0) / h) * 100).toFixed(3);
        const escaped = line.text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `    <div class="line" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${escaped}</div>`;
      })
      .join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${filename} - Digital Document</title>
  <style>
    body { margin: 0; padding: 40px 20px; background: #0f172a; display: flex; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .page { position: relative; width: 100%; max-width: ${w}px; aspect-ratio: ${w} / ${h}; background: #ffffff; box-shadow: 0 8px 30px rgba(0,0,0,0.5); overflow: hidden; border-radius: 4px; }
    .line { position: absolute; font-size: clamp(10px, 1.3vw, 20px); line-height: 1.15; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  </style>
</head>
<body>
  <div class="page">
${linesHtml}
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="modal-backdrop"
      id="imageModal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h3 id="modalTitle">{filename}</h3>
          <button
            type="button"
            className="modal-close"
            id="modalCloseBtn"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        <div className="modal-toolbar">
          <div className="view-mode-tabs">
            <button
              type="button"
              className={`tab-btn ${viewMode === "digital-doc" ? "active" : ""}`}
              id="tabBtnDigital"
              onClick={() => setViewMode("digital-doc")}
            >
              Digital Document
            </button>
            <button
              type="button"
              className={`tab-btn ${viewMode === "overlay" ? "active" : ""}`}
              id="tabBtnOverlay"
              onClick={() => setViewMode("overlay")}
            >
              Document Overlay
            </button>
            <button
              type="button"
              className={`tab-btn ${viewMode === "raw" ? "active" : ""}`}
              id="tabBtnRaw"
              onClick={() => setViewMode("raw")}
            >
              Raw Text
            </button>
          </div>

          <div className="modal-actions">
            {/* Zoom Controls */}
            <button
              type="button"
              className="action-btn"
              title="Zoom In"
              onClick={() => setZoom((z) => Math.min(z + 25, 200))}
            >
              +
            </button>
            <button
              type="button"
              className="action-btn"
              title="Reset Zoom"
              onClick={() => setZoom(100)}
            >
              {zoom}%
            </button>
            <button
              type="button"
              className="action-btn"
              title="Zoom Out"
              onClick={() => setZoom((z) => Math.max(z - 25, 50))}
            >
              -
            </button>

            <button
              type="button"
              className="action-btn"
              id="copyStructuredBtn"
              onClick={handleCopyStructured}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copyStatus === "Copied!" ? "Copied!" : "Copy Structured Text"}
            </button>
            <button
              type="button"
              className="action-btn"
              id="exportHtmlBtn"
              onClick={handleExportHtml}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export HTML
            </button>
          </div>
        </div>

        <div className="modal-body">
          <div className="modal-image-col">
            {/* Digital Document View */}
            {viewMode === "digital-doc" && (
              <div className="view-panel active" id="viewDigitalDoc">
                {hasLayout && item.width && item.height ? (
                  <div className="digital-doc-wrapper" id="digitalDocWrapper">
                    <div
                      className="digital-doc-page"
                      id="digitalDocPage"
                      style={{
                        aspectRatio: `${item.width} / ${item.height}`,
                        transform: `scale(${zoom / 100})`,
                        transformOrigin: "top center",
                      }}
                    >
                      {lines.map((line) => {
                        const left = ((line.bbox.x0 / w) * 100).toFixed(3);
                        const top = ((line.bbox.y0 / h) * 100).toFixed(3);
                        const width = (
                          ((line.bbox.x1 - line.bbox.x0) / w) *
                          100
                        ).toFixed(3);
                        const height = (
                          ((line.bbox.y1 - line.bbox.y0) / h) *
                          100
                        ).toFixed(3);
                        const fontSize = Math.max(
                          9,
                          Math.min(22, (Number(height) / 100) * 460 * 0.8),
                        );

                        return (
                          <div
                            key={`doc-line-${line.bbox.x0}-${line.bbox.y0}-${line.bbox.x1}-${line.bbox.y1}-${line.text}`}
                            className="layout-text-line"
                            style={{
                              left: `${left}%`,
                              top: `${top}%`,
                              width: `${Math.max(Number(width), 1)}%`,
                              height: `${Math.max(Number(height), 1)}%`,
                              fontSize: `${fontSize}px`,
                            }}
                            title={`${line.text} (${Math.round(line.confidence)}% conf)`}
                          >
                            {line.text}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="no-layout-msg" id="noLayoutMsg">
                    No layout structure detected for this image.
                  </div>
                )}
              </div>
            )}

            {/* Document Overlay View */}
            {viewMode === "overlay" && (
              <div className="view-panel active" id="viewOverlay">
                <div
                  className="ocr-overlay-wrapper"
                  id="ocrOverlayWrapper"
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: "top center",
                  }}
                >
                  <img
                    id="modalOverlayImg"
                    src={imgUrl}
                    alt="Scanned Preview"
                  />
                  {hasLayout && item.width && item.height && (
                    <div
                      className="ocr-overlay-container"
                      id="ocrOverlayContainer"
                    >
                      {lines.map((line) => {
                        const left = ((line.bbox.x0 / w) * 100).toFixed(3);
                        const top = ((line.bbox.y0 / h) * 100).toFixed(3);
                        const width = (
                          ((line.bbox.x1 - line.bbox.x0) / w) *
                          100
                        ).toFixed(3);
                        const height = (
                          ((line.bbox.y1 - line.bbox.y0) / h) *
                          100
                        ).toFixed(3);

                        return (
                          <div
                            key={`overlay-line-${line.bbox.x0}-${line.bbox.y0}-${line.bbox.x1}-${line.bbox.y1}-${line.text}`}
                            className="ocr-overlay-box"
                            style={{
                              left: `${left}%`,
                              top: `${top}%`,
                              width: `${Math.max(Number(width), 0.5)}%`,
                              height: `${Math.max(Number(height), 0.5)}%`,
                            }}
                            title={`${line.text} (${Math.round(line.confidence)}% conf)`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Raw Image View */}
            {viewMode === "raw" && (
              <div className="view-panel active" id="viewRaw">
                <div
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: "top center",
                  }}
                >
                  <img id="modalImage" src={imgUrl} alt="Raw Scan Preview" />
                </div>
              </div>
            )}
          </div>

          <div className="modal-info-col">
            <div className="meta-list">
              <div className="meta-item">
                <span>Path:</span> <code id="modalPath">{item.path}</code>
              </div>
              <div className="meta-item">
                <span>Dimensions:</span>{" "}
                <strong id="modalDims">
                  {item.width && item.height
                    ? `${item.width} x ${item.height} px`
                    : "Unknown"}
                </strong>
              </div>
              <div className="meta-item">
                <span>Confidence:</span>{" "}
                <strong id="modalConf">{item.confidence.toFixed(1)}%</strong>
              </div>
              <div className="meta-item">
                <span>Structure:</span>{" "}
                <strong id="modalStructure">
                  {hasLayout
                    ? `${blocks.length} blocks, ${lines.length} lines`
                    : "Raw text only"}
                </strong>
              </div>
              <div className="meta-item">
                <span>File Size:</span>{" "}
                <strong id="modalSize">{formatBytes(item.file_size)}</strong>
              </div>
            </div>
            <div className="raw-text-box">
              <div className="text-box-header">
                <span>Extracted OCR Text</span>
                <button
                  type="button"
                  className="copy-text-btn"
                  id="copyRawBtn"
                  title="Copy raw text"
                  onClick={handleCopyRaw}
                >
                  {copyStatus === "Raw Copied!" ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre id="modalText">
                {item.ocr_text || "(No text recognized)"}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
