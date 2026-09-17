import type React from "react";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalPages <= 1) return null;

  return (
    <div className="pagination" id="pagination" style={{ display: "flex" }}>
      <button
        type="button"
        id="prevBtn"
        className="btn btn-secondary"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        &larr; Previous
      </button>
      <span className="page-indicator" id="pageIndicator">
        Page {currentPage} of {totalPages}
      </span>
      <button
        type="button"
        id="nextBtn"
        className="btn btn-secondary"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        Next &rarr;
      </button>
    </div>
  );
};
