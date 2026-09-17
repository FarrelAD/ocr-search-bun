// OCR Image Search Frontend Application

let activeSearchDebounce = null;
let currentItems = [];

// DOM Elements
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const uploadStatus = document.getElementById("uploadStatus");

const resultsTitle = document.getElementById("resultsTitle");
const resultsCount = document.getElementById("resultsCount");
const resultsGrid = document.getElementById("resultsGrid");
const loadingSpinner = document.getElementById("loadingSpinner");
const emptyState = document.getElementById("emptyState");

const statTotal = document.getElementById("statTotal");
const statAvgConf = document.getElementById("statAvgConf");
const statSize = document.getElementById("statSize");

// Modal Elements
const imageModal = document.getElementById("imageModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalImage = document.getElementById("modalImage");
const _modalTitle = document.getElementById("modalTitle");
const modalPath = document.getElementById("modalPath");
const modalDims = document.getElementById("modalDims");
const modalConf = document.getElementById("modalConf");
const modalSize = document.getElementById("modalSize");
const modalText = document.getElementById("modalText");

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
  loadStats();
  loadAllImages();

  // Search Input Event Listeners
  searchInput.addEventListener("input", onSearchInput);
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.style.display = "none";
    loadAllImages();
  });

  // File Upload Event Listeners
  browseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(Array.from(e.target.files));
    }
  });

  // Drag and Drop
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    if (dt?.files && dt.files.length > 0) {
      handleFilesUpload(Array.from(dt.files));
    }
  });

  // Modal Close
  modalCloseBtn.addEventListener("click", closeModal);
  imageModal.addEventListener("click", (e) => {
    if (e.target === imageModal) closeModal();
  });
});

async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    if (!res.ok) return;
    const data = await res.json();
    statTotal.textContent = data.totalImages ?? 0;
    statAvgConf.textContent = `${Math.round(data.avgConfidence ?? 0)}%`;
    const kb = ((data.totalTextBytes ?? 0) / 1024).toFixed(1);
    statSize.textContent = `${kb} KB`;
  } catch (err) {
    console.error("Failed to load stats:", err);
  }
}

async function loadAllImages() {
  showLoading(true);
  resultsTitle.textContent = "All Indexed Images";

  try {
    const res = await fetch("/api/images?limit=50");
    if (!res.ok) throw new Error("Failed to load images");
    const data = await res.json();
    currentItems = data.images || [];
    renderResults(currentItems, false);
  } catch (err) {
    console.error(err);
    renderResults([], false);
  } finally {
    showLoading(false);
  }
}

function onSearchInput() {
  const query = searchInput.value.trim();
  clearSearchBtn.style.display = query ? "block" : "none";

  clearTimeout(activeSearchDebounce);

  if (!query) {
    loadAllImages();
    return;
  }

  activeSearchDebounce = setTimeout(() => {
    performSearch(query);
  }, 300);
}

async function performSearch(query) {
  showLoading(true);
  resultsTitle.textContent = `Search Results for "${query}"`;

  try {
    const res = await fetch(
      `/api/search?q=${encodeURIComponent(query)}&limit=50`,
    );
    if (!res.ok) throw new Error("Search request failed");
    const data = await res.json();
    currentItems = data || [];
    renderResults(currentItems, true);
  } catch (err) {
    console.error(err);
    renderResults([], true);
  } finally {
    showLoading(false);
  }
}

function showLoading(loading) {
  loadingSpinner.style.display = loading ? "block" : "none";
  if (loading) {
    emptyState.style.display = "none";
    resultsGrid.innerHTML = "";
  }
}

function renderResults(items, isSearch) {
  resultsCount.textContent = `${items.length} item${items.length === 1 ? "" : "s"}`;
  resultsGrid.innerHTML = "";

  if (items.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  items.forEach((item, _idx) => {
    const card = document.createElement("div");
    card.className = "image-card";

    const imageUrl = `/api/image-file?path=${encodeURIComponent(item.path)}`;
    const scoreBadge =
      isSearch && typeof item.score === "number"
        ? `<span class="badge score">Score: ${item.score.toFixed(2)}</span>`
        : "";
    const confBadge = `<span class="badge conf">${Math.round(item.confidence)}% conf</span>`;

    const snippetText = item.snippet || `${item.ocr_text.slice(0, 150)}...`;

    card.innerHTML = `
      <div class="card-thumb-wrap">
        <img src="${imageUrl}" alt="Preview" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\' fill=\\'%2394a3b8\\'><text x=\\'20\\' y=\\'55\\' font-size=\\'12\\'>No Image</text></svg>';" />
        <div class="badge-row">
          ${scoreBadge}
          ${confBadge}
        </div>
      </div>
      <div class="card-body">
        <div class="card-path" title="${item.path}">${item.path}</div>
        <div class="card-snippet">${snippetText}</div>
        <div class="card-footer">
          <button class="btn btn-primary detail-btn">View Details</button>
          <button class="btn btn-danger delete-btn">Unindex</button>
        </div>
      </div>
    `;

    card
      .querySelector(".detail-btn")
      .addEventListener("click", () => openModal(item));
    card
      .querySelector(".delete-btn")
      .addEventListener("click", () => deleteImageRecord(item.path));

    resultsGrid.appendChild(card);
  });
}

async function handleFilesUpload(files) {
  uploadStatus.style.color = "var(--accent-color)";
  uploadStatus.textContent = `Uploading and scanning ${files.length} file(s)...`;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const formData = new FormData();
    formData.append("file", file);

    try {
      uploadStatus.textContent = `Scanning [${i + 1}/${files.length}]: ${file.name}...`;
      const res = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
    } catch (err) {
      console.error(`Failed to scan file ${file.name}:`, err);
    }
  }

  uploadStatus.style.color = "var(--success-color)";
  uploadStatus.textContent = `Scan complete! Updated index.`;
  setTimeout(() => {
    uploadStatus.textContent = "";
  }, 4000);

  loadStats();
  if (searchInput.value.trim()) {
    performSearch(searchInput.value.trim());
  } else {
    loadAllImages();
  }
}

async function deleteImageRecord(path) {
  if (!confirm(`Are you sure you want to unindex "${path}"?`)) return;

  try {
    const res = await fetch(
      `/api/image-file?path=${encodeURIComponent(path)}`,
      {
        method: "DELETE",
      },
    );

    if (res.ok) {
      loadStats();
      if (searchInput.value.trim()) {
        performSearch(searchInput.value.trim());
      } else {
        loadAllImages();
      }
    }
  } catch (err) {
    console.error("Failed to delete record:", err);
  }
}

function openModal(item) {
  const imageUrl = `/api/image-file?path=${encodeURIComponent(item.path)}`;
  modalImage.src = imageUrl;
  modalPath.textContent = item.path;
  modalDims.textContent = `${item.width ?? "?"} x ${item.height ?? "?"}`;
  modalConf.textContent = `${item.confidence.toFixed(1)}%`;
  modalSize.textContent = `${(item.file_size / 1024).toFixed(1)} KB`;
  modalText.textContent = item.ocr_text || "(No text extracted)";

  imageModal.style.display = "flex";
}

function closeModal() {
  imageModal.style.display = "none";
}
