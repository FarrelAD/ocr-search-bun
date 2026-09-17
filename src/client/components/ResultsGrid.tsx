import type React from "react";
import type { ImageRecord, SearchResult } from "../types.ts";
import { parseLayout } from "../utils.ts";

interface ResultsGridProps {
  items: (ImageRecord | SearchResult)[];
  isSearch: boolean;
  onOpenModal: (item: ImageRecord | SearchResult) => void;
  onDelete: (path: string) => void;
}

export const ResultsGrid: React.FC<ResultsGridProps> = ({
  items,
  isSearch,
  onOpenModal,
  onDelete,
}) => {
  if (!items || items.length === 0) {
    return (
      <div className="empty-state" id="emptyState">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <h3>No matching images found</h3>
        <p>Try searching for different keywords or drag new images to scan.</p>
      </div>
    );
  }

  return (
    <div className="results-grid" id="resultsGrid">
      {items.map((item) => {
        const hasLayout = Boolean(parseLayout(item));
        const filename = item.path.split("/").pop() || item.path;
        const snippet =
          isSearch && "snippet" in item && item.snippet
            ? item.snippet
            : item.ocr_text || "";

        return (
          <div key={item.path} className="image-card">
            <div
              className="card-image-wrapper"
              onClick={() => onOpenModal(item)}
            >
              <img
                src={`/api/image-file?path=${encodeURIComponent(item.path)}`}
                alt={filename}
                loading="lazy"
              />
              <div className="card-confidence">
                {item.confidence.toFixed(0)}%
              </div>
              {hasLayout && (
                <span
                  className="badge badge-layout"
                  title="Digital layout and bounding boxes available"
                >
                  Layout
                </span>
              )}
            </div>
            <div className="card-info">
              <div className="card-filename" title={item.path}>
                {filename}
              </div>
              <div
                className="card-snippet"
                dangerouslySetInnerHTML={{ __html: snippet }}
              />
              <div className="card-actions">
                <button
                  type="button"
                  className="btn btn-primary open-btn"
                  onClick={() => onOpenModal(item)}
                >
                  View Details
                </button>
                <button
                  type="button"
                  className="btn btn-danger delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Remove ${filename} from the index?`)) {
                      onDelete(item.path);
                    }
                  }}
                >
                  Unindex
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
