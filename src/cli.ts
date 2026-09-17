import { parseArgs } from "node:util";
import { startServer } from "./server/index.ts";
import { closeDb } from "./services/db.service.ts";
import { getStats } from "./services/image.service.ts";
import { scanPath } from "./services/scanner.service.ts";
import { executeSearch } from "./services/search.service.ts";
import type { ScanProgressInfo } from "./types/scanner.types.ts";

function printHelp() {
  console.log(`
OCR Image Search System (Bun + MySQL + Tesseract.js)

Usage:
  bun run src/cli.ts <command> [options]

Commands:
  scan <file-or-dir>   Scan images and index extracted OCR text in MySQL
                       Options: --force, --lang <lang>

  search <query>       Search indexed images using full-text search
                       Options: --limit <n> (default 10), --json, --layout

  stats                Display database statistics and index counts

  serve                Launch the local Web Dashboard & REST API
                       Options: --port <n> (default 3000), --host <host>

Examples:
  bun run src/cli.ts scan ./images --force
  bun run src/cli.ts search "Invoice total" --limit 5
  bun run src/cli.ts search "Invoice total" --layout
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
          lang: {
            type: "string",
            short: "l",
            default: process.env.OCR_LANG || "eng",
          },
        },
        allowPositionals: true,
      });

      const targetPath = positionals[0];
      if (!targetPath) {
        console.error(
          "Error: Please provide a file or directory path to scan.",
        );
        console.error(
          "Usage: bun run src/cli.ts scan <file-or-directory> [--force] [--lang eng]",
        );
        process.exit(1);
      }

      console.log(`Starting scan of: ${targetPath}`);
      console.log(
        `Options: force=${values.force}, lang=${values.lang}, concurrency=1\n`,
      );

      const onProgress = (info: ScanProgressInfo) => {
        const pct = Math.round((info.current / info.total) * 100);
        const icon =
          info.status === "indexed"
            ? "✓"
            : info.status === "skipped"
              ? "↷"
              : "✗";
        let extra = ` (${info.status})`;
        if (info.error) {
          extra = ` (${info.error})`;
        } else if (info.status === "indexed") {
          const confPart =
            typeof info.confidence === "number"
              ? ` - ${info.confidence.toFixed(1)}% conf`
              : "";
          const structPart =
            typeof info.blocks === "number" && typeof info.lines === "number"
              ? `, ${info.blocks} blocks, ${info.lines} lines`
              : "";
          extra = ` (indexed${confPart}${structPart})`;
        }
        console.log(
          `[${info.current}/${info.total} - ${pct}%] ${icon} ${info.path}${extra}`,
        );
      };

      const startTime = Date.now();
      try {
        const result = await scanPath(targetPath, {
          force: Boolean(values.force),
          lang: values.lang,
          onProgress,
        });

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log("\n--- Scan Summary ---");
        console.log(`Total Scanned:  ${result.totalScanned}`);
        console.log(`Newly Indexed:  ${result.indexed}`);
        console.log(`Skipped:        ${result.skipped}`);
        console.log(`Errors:         ${result.errors}`);
        console.log(`Time Elapsed:   ${elapsed}s\n`);
      } finally {
        await closeDb();
      }
      break;
    }

    case "search": {
      const { values, positionals } = parseArgs({
        args: commandArgs,
        options: {
          limit: { type: "string", short: "n", default: "10" },
          json: { type: "boolean", default: false },
          layout: { type: "boolean", default: false },
        },
        allowPositionals: true,
      });

      const query = positionals.join(" ").trim();
      if (!query) {
        console.error("Error: Please provide a search query.");
        console.error(
          'Usage: bun run src/cli.ts search "<query>" [--limit 10] [--json] [--layout]',
        );
        process.exit(1);
      }

      const limit = Number.parseInt(values.limit || "10", 10);
      let results: Awaited<ReturnType<typeof executeSearch>>;
      try {
        results = await executeSearch(query, { limit });
      } finally {
        await closeDb();
      }

      if (values.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(
          `\nFound ${results.length} results for query: "${query}"\n`,
        );
        if (results.length === 0) {
          console.log("No matching images found.");
          break;
        }

        results.forEach((item, idx) => {
          const highlightedSnippet = item.snippet
            .replaceAll("<mark>", "\x1b[1;\x1b[33m")
            .replaceAll("</mark>", "\x1b[0m");

          console.log(`[${idx + 1}] ${item.path}`);
          console.log(
            `    Score: ${item.score.toFixed(2)} | Confidence: ${item.confidence.toFixed(1)}% | Size: ${(Number(item.file_size) / 1024).toFixed(1)} KB`,
          );
          if (values.layout) {
            let structuredText = "";
            const layout = item.layout;
            if (
              layout &&
              Array.isArray(layout.blocks) &&
              layout.blocks.length > 0
            ) {
              const blockTexts: string[] = [];
              for (const block of layout.blocks) {
                const paraTexts: string[] = [];
                for (const para of block.paragraphs || []) {
                  const lineTexts = (para.lines || [])
                    .map((l) => l.text)
                    .filter(Boolean);
                  if (lineTexts.length > 0) {
                    paraTexts.push(lineTexts.join("\n    "));
                  }
                }
                if (paraTexts.length > 0) {
                  blockTexts.push(paraTexts.join("\n\n    "));
                } else if (block.text) {
                  blockTexts.push(block.text);
                }
              }
              if (blockTexts.length > 0) {
                structuredText = blockTexts.join("\n    ---\n    ");
              }
            } else if (
              layout &&
              Array.isArray(layout.lines) &&
              layout.lines.length > 0
            ) {
              structuredText = layout.lines.map((l) => l.text).join("\n    ");
            }
            if (structuredText) {
              console.log(`    Structured Text:\n    ${structuredText}`);
            } else {
              console.log(`    Snippet: ${highlightedSnippet}`);
            }
          } else {
            console.log(`    Snippet: ${highlightedSnippet}`);
          }
          console.log("");
        });
      }
      break;
    }

    case "stats": {
      try {
        const stats = await getStats();
        console.log("\n--- Database Statistics ---");
        console.log(`Total Images Indexed: ${stats.totalImages}`);
        console.log(
          `Total Extracted Text: ${(stats.totalTextBytes / 1024).toFixed(2)} KB`,
        );
        console.log(`Average Confidence:   ${stats.avgConfidence.toFixed(1)}%`);
        console.log(
          `Last Scanned At:      ${
            stats.lastScannedAt
              ? new Date(stats.lastScannedAt).toISOString()
              : "Never"
          }\n`,
        );
      } finally {
        await closeDb();
      }
      break;
    }

    case "serve": {
      const { values } = parseArgs({
        args: commandArgs,
        options: {
          port: { type: "string", short: "p", default: "3000" },
          host: { type: "string", short: "h", default: "0.0.0.0" },
        },
      });

      const port = Number.parseInt(values.port || "3000", 10);
      const host = values.host || "0.0.0.0";

      await startServer({ port, host });
      break;
    }

    default: {
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exit(1);
    }
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
