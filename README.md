# OCR Image Search System

A high-performance image OCR scanning and full-text search system powered by **Bun**, **Tesseract.js**, **MySQL FULLTEXT search**, and a modern web dashboard.

## Overview & Architecture

The OCR Image Search System allows you to index text embedded within images, perform fast full-text searches across extracted text, view statistics, and manage image uploads via CLI or Web UI.

```
┌─────────────────────────────────────────────────────────────┐
│                      Web Dashboard                          │
│          (HTML5 Drag & Drop, Live Search & Stats)           │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / REST API
┌──────────────────────────────▼──────────────────────────────┐
│                    Bun HTTP Web Server                      │
│        (REST Endpoints: /api/scan, /api/search, etc.)       │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────┐┌──────────────▼──────────────┐
│     Tesseract.js Engine     ││   MySQL FULLTEXT Database    │
│  (Optical Character Recog.) ││  (Fast Indexing & Querying)  │
└─────────────────────────────┘└──────────────────────────────┘
```

### Key Features
- **OCR Text Extraction**: Extract text from images (`.png`, `.jpg`, `.jpeg`, `.webp`, `.bmp`) using Tesseract.js.
- **MySQL FULLTEXT Indexing**: Natural language & boolean search modes for fast keyword retrieval.
- **CLI Commands**: CLI tools to scan image directories, search index, view stats, and run the server.
- **Web Dashboard**: Interactive UI for drag-and-drop uploading, image previewing, searching, and viewing system stats.
- **Fast & Lightweight**: Built on top of the Bun runtime for sub-millisecond API responses and fast startup.

---

## Prerequisites

- **Bun**: v1.0.0 or higher ([Install Bun](https://bun.sh))
- **MySQL**: v8.0 or higher with `FULLTEXT` index support

---

## Environment Setup

1. Copy `.env.example` to create your local `.env` configuration:

   ```bash
   cp .env.example .env
   ```

2. Configure your MySQL credentials in `.env`:

   ```env
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=root
   MYSQL_PASSWORD=your_password
   MYSQL_DATABASE=ocr_search
   ```

---

## Quick Start & Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/USERNAME/ocr-search-bun.git
   cd ocr-search-bun
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Ensure MySQL server is running. The application will automatically create the database (`ocr_search`) and table schema upon first run or initial database access.

---

## CLI Usage

The system includes CLI commands accessible via `bun run` or directly using `bun run src/cli.ts <command>`.

### 1. Scan Directory (`scan`)
Scans a target directory for images, performs OCR, and stores results in the database.

```bash
bun run scan -- --dir ./uploads
```
*Options:*
- `--dir <path>`: Directory containing images to scan (default: `./uploads`).
- `--lang <code>`: OCR language code (default: `eng`).

### 2. Search Text (`search`)
Search indexed OCR text by query string.

```bash
bun run search -- --query "receipt"
```
*Options:*
- `--query <text>`: Search keyword or phrase.
- `--limit <number>`: Maximum results to return (default: `10`).

### 3. View Statistics (`stats`)
Displays database statistics (total indexed images, total text bytes, average OCR confidence, and last scan timestamp).

```bash
bun run stats
```

### 4. Serve Web API & Dashboard (`serve`)
Starts the Bun HTTP server serving the Web UI and REST API.

```bash
bun run serve
```
By default, the server runs on `http://localhost:3000`.

---

## Web Dashboard Guide

When running `bun run serve`, navigate to `http://localhost:3000` in your web browser to access the dashboard.

- **Upload & Scan**: Drag & drop images or click to select files for automated OCR scanning and indexing.
- **Search Bar**: Real-time search across indexed image text with match highlighting and preview cards.
- **Stats Counter**: Live statistics showing total scanned images, OCR confidence, and database usage.

---

## Testing

Run the test suite to verify database operations, OCR functions, API endpoints, and CLI interface:

```bash
bun test
```

---

## License

[MIT](LICENSE)
