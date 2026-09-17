import { parseArgs } from "node:util";
import { initDb, getStats, closeDb } from "./services/db.service.ts";
import { scanPath } from "./services/scanner.service.ts";
import { executeSearch } from "./services/search.service.ts";
import { startServer } from "./server/index.ts";

function printHelp() {
  console.log(`
OCR Image Search System (Bun + MySQL + Tesseract.js)

Usage:
  bun run src/cli.ts <command> [options]

Commands:
  scan <file-or-dir>   Scan images and index extracted OCR text in MySQL
                       Options: --force, --lang <lang>

  search <query>       Search indexed images using full-text search
                       Options: --limit <n> (default 10), --json

  stats                Display database statistics and index counts

  serve                Launch the local Web Dashboard & REST API
                       Options: --port <n> (default 3000), --host <host>

Examples:
  bun run src/cli.ts scan ./images --force
  bun run src/cli.ts search "Invoice total" --limit 5
  bun run src/cli.ts stats
  bun run src/cli.ts serve --port 3000
`);
}

export async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const command = argv[0];
  const commandArgs = argv.slice(1);

  switch (command) {
    case "scan": {
      const { values, positionals } = parseArgs({
        args: commandArgs,
        options: {
          force: { type: "boolean", short: "f", default: false },
          lang: { type: "string", short: "l", default: "eng" },
        },
        allowPositionals: true,
      });

      const targetPath = positionals[0];
      if (!targetPath) {
        console.error("Error: Target file or directory path is required for 'scan'.");
        console.error("Usage: bun run src/cli.ts scan <file-or-directory> [--force] [--lang eng]");
        process.exit(1);
      }

      console.log(`Initializing database connection...`);
      await initDb();

      console.log(`Starting OCR scan for path: "${targetPath}" (force: ${values.force}, lang: ${values.lang})...`);
      const startTime = Date.now();

      const result = await scanPath(targetPath, {
        force: values.force,
        lang: values.lang,
        onProgress: (info) => {
          const pct = Math.round((info.current / info.total) * 100);
          const icon = info.status === "indexed" ? "✓" : info.status === "skipped" ? "↷" : "✗";
          console.log(`[${info.current}/${info.total} - ${pct}%] ${icon} ${info.path} (${info.status})`);
        },
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log("\n--- Scan Summary ---");
      console.log(`Total Scanned:  ${result.totalScanned}`);
      console.log(`Newly Indexed:  ${result.indexed}`);
      console.log(`Skipped:        ${result.skipped}`);
      console.log(`Errors:         ${result.errors}`);
      console.log(`Time Elapsed:   ${elapsed}s\n`);

      await closeDb();
      break;
    }

    case "search": {
      const { values, positionals } = parseArgs({
        args: commandArgs,
        options: {
          limit: { type: "string", short: "n", default: "10" },
          json: { type: "boolean", default: false },
        },
        allowPositionals: true,
      });

      const query = positionals.join(" ");
      if (!query) {
        console.error("Error: Search query string is required for 'search'.");
        console.error("Usage: bun run src/cli.ts search <query> [--limit 10] [--json]");
        process.exit(1);
      }

      await initDb();
      const limit = Number(values.limit) || 10;
      const results = await executeSearch(query, { limit });

      if (values.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(`\nFound ${results.length} results for query: "${query}"\n`);
        results.forEach((item, idx) => {
          const score = typeof item.score === "number" ? item.score.toFixed(4) : item.score;
          const conf = typeof item.confidence === "number" ? item.confidence.toFixed(1) : item.confidence;
          // Format terminal snippet: replace <mark> tags with ANSI yellow bold
          const termSnippet = item.snippet
            .replaceAll("<mark>", "\x1b[1;\x1b[33m")
            .replaceAll("</mark>", "\x1b[0m");

          console.log(`[${idx + 1}] Score: ${score} | Confidence: ${conf}% | Dimensions: ${item.width ?? "?"}x${item.height ?? "?"}`);
          console.log(`    Path: ${item.path}`);
          console.log(`    Snippet: ${termSnippet}\n`);
        });
      }

      await closeDb();
      break;
    }

    case "stats": {
      await initDb();
      const stats = await getStats();
      console.log("\n--- OCR Search Database Statistics ---");
      console.log(`Total Indexed Images: ${stats.totalImages}`);
      console.log(`Total Text Size:      ${(stats.totalTextBytes / 1024).toFixed(2)} KB (${stats.totalTextBytes} bytes)`);
      console.log(`Average Confidence:   ${stats.avgConfidence.toFixed(2)}%`);
      console.log(`Last Scanned At:      ${stats.lastScannedAt ? new Date(stats.lastScannedAt).toLocaleString() : "Never"}\n`);
      await closeDb();
      break;
    }

    case "serve": {
      const { values } = parseArgs({
        args: commandArgs,
        options: {
          port: { type: "string", short: "p", default: "3000" },
          host: { type: "string", short: "h", default: "127.0.0.1" },
        },
      });

      const port = Number(values.port) || 3000;
      const host = values.host || "127.0.0.1";

      await startServer({ port, host });
      break;
    }

    default:
      console.error(`Unknown command: "${command}"`);
      printHelp();
      process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
