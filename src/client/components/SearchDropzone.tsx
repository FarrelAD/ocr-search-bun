import type React from "react";
import { useRef, useState } from "react";

interface SearchDropzoneProps {
  onSearch: (query: string) => void;
  onUpload: (file: File, lang: string) => void;
  isScanning: boolean;
  uploadStatus: string;
  uploadProgressPercent: number;
}

export const SearchDropzone: React.FC<SearchDropzoneProps> = ({
  onSearch,
  onUpload,
  isScanning,
  uploadStatus,
  uploadProgressPercent,
}) => {
  const [searchInput, setSearchInput] = useState("");
  const [selectedLang, setSelectedLang] = useState("eng");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearch(searchInput.trim());
    }
  };

  const handleSearchClick = () => {
    onSearch(searchInput.trim());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files[0], selectedLang);
      e.target.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onUpload(files[0], selectedLang);
    }
  };

  return (
    <section className="controls-section">
      <div className="search-box">
        <input
          type="text"
          id="searchInput"
          placeholder="Search extracted text, keywords, numbers..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <select
          id="langSelect"
          className="lang-select"
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
        >
          <option value="eng">English (eng)</option>
          <option value="deu">German (deu)</option>
          <option value="fra">French (fra)</option>
          <option value="spa">Spanish (spa)</option>
          <option value="ita">Italian (ita)</option>
        </select>
        <button
          type="button"
          id="searchBtn"
          className="btn btn-primary"
          onClick={handleSearchClick}
        >
          Search
        </button>
      </div>

      <div
        className={`upload-zone ${isDragOver ? "dragover" : ""}`}
        id="dropZone"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="fileInput"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="upload-icon"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <div className="upload-text">
          Drop scan or image here, or <span>browse</span>
        </div>
        <div className="upload-hint">
          Supports PNG, JPG, WebP, BMP, TIFF — Instant OCR &amp; Full-Text
          Indexing
        </div>

        {isScanning && (
          <div
            className="upload-progress-container"
            id="uploadProgress"
            style={{ display: "block" }}
          >
            <div className="progress-bar">
              <div
                className="progress-fill"
                id="uploadProgressFill"
                style={{ width: `${uploadProgressPercent}%` }}
              />
            </div>
            <div className="status-text" id="uploadStatusText">
              {uploadStatus}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
