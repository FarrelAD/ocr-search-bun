import type React from "react";
import type { DatabaseStats } from "../types.ts";
import { formatBytes } from "../utils.ts";

interface HeaderProps {
  stats: DatabaseStats | null;
}

export const Header: React.FC<HeaderProps> = ({ stats }) => {
  return (
    <header className="app-header">
      <div className="logo-area">
        <svg
          className="logo-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3" />
          <line x1="9" y1="12" x2="15" y2="12" />
        </svg>
        <h1>OCR Image Search</h1>
      </div>
      <div className="stats-pills" id="statsContainer">
        <span className="pill">
          Images:{" "}
          <strong id="statTotal">
            {stats ? stats.totalImages.toLocaleString() : "0"}
          </strong>
        </span>
        <span className="pill">
          Confidence:{" "}
          <strong id="statAvgConf">
            {stats ? `${stats.avgConfidence.toFixed(1)}%` : "0%"}
          </strong>
        </span>
        <span className="pill">
          Data:{" "}
          <strong id="statSize">
            {stats ? formatBytes(stats.totalTextBytes) : "0 B"}
          </strong>
        </span>
      </div>
    </header>
  );
};
