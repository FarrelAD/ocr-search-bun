import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { DocumentModal } from "./components/DocumentModal.tsx";
import { Header } from "./components/Header.tsx";
import { Pagination } from "./components/Pagination.tsx";
import { ResultsGrid } from "./components/ResultsGrid.tsx";
import { SearchDropzone } from "./components/SearchDropzone.tsx";
import type { DatabaseStats, ImageRecord, SearchResult } from "./types.ts";

const PAGE_SIZE = 20;

export const App: React.FC = () => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [items, setItems] = useState<(ImageRecord | SearchResult)[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentQuery, setCurrentQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedItem, setSelectedItem] = useState<
    ImageRecord | SearchResult | null
  >(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  }, []);

  const loadImages = useCallback(async (page: number) => {
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const res = await fetch(
        `/api/images?limit=${PAGE_SIZE}&offset=${offset}`,
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data.images || []);
        setTotalItems(data.total || 0);
      }
    } catch (err) {
      console.error("Error loading images:", err);
      setItems([]);
      setTotalItems(0);
    }
  }, []);

  const executeSearch = useCallback(async (query: string, page: number) => {
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${offset}`,
      );
      if (res.ok) {
        const data = await res.json();
        setItems(data || []);
        // Approximate total for search
        setTotalItems(
          data.length === PAGE_SIZE
            ? page * PAGE_SIZE + 1
            : (page - 1) * PAGE_SIZE + data.length,
        );
      }
    } catch (err) {
      console.error("Error executing search:", err);
      setItems([]);
      setTotalItems(0);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadImages(1);
  }, [loadStats, loadImages]);

  const handleSearch = (query: string) => {
    setCurrentQuery(query);
    setCurrentPage(1);
    if (query) {
      executeSearch(query, 1);
    } else {
      loadImages(1);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (currentQuery) {
      executeSearch(currentQuery, newPage);
    } else {
      loadImages(newPage);
    }
  };

  const handleUpload = async (file: File, lang: string) => {
    if (isScanning) return;
    setIsScanning(true);
    setUploadProgress(25);
    setUploadStatus("Uploading image...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setUploadProgress(50);
      setUploadStatus("Running OCR & layout analysis...");

      const res = await fetch(`/api/scan?lang=${encodeURIComponent(lang)}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Scan failed");
      }

      const data = await res.json();
      setUploadProgress(100);
      setUploadStatus("Analysis complete!");

      setTimeout(() => {
        setIsScanning(false);
        setUploadProgress(0);
        setUploadStatus("");
        loadStats();
        loadImages(1);
        if (data.image) {
          setSelectedItem(data.image);
        }
      }, 500);
    } catch (err: any) {
      setUploadStatus(`Error: ${err.message || String(err)}`);
      setTimeout(() => {
        setIsScanning(false);
        setUploadProgress(0);
        setUploadStatus("");
      }, 3500);
    }
  };

  const handleDelete = async (filePath: string) => {
    try {
      const res = await fetch(
        `/api/image-file?path=${encodeURIComponent(filePath)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        loadStats();
        if (currentQuery) {
          executeSearch(currentQuery, currentPage);
        } else {
          loadImages(currentPage);
        }
      }
    } catch (err) {
      console.error("Error deleting image:", err);
    }
  };

  return (
    <div className="app-container">
      <Header stats={stats} />

      <main className="main-content">
        <SearchDropzone
          onSearch={handleSearch}
          onUpload={handleUpload}
          isScanning={isScanning}
          uploadStatus={uploadStatus}
          uploadProgressPercent={uploadProgress}
        />

        <section className="results-section">
          <ResultsGrid
            items={items}
            isSearch={Boolean(currentQuery)}
            onOpenModal={(item) => setSelectedItem(item)}
            onDelete={handleDelete}
          />

          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        </section>
      </main>

      <DocumentModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
};
