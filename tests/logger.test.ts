import { describe, expect, spyOn, test } from "bun:test";
import { createApp } from "../src/server/app.ts";
import { logger } from "../src/utils/logger.ts";

describe("Logger & Bun HTTP Server Error/Request Logging", () => {
  test("logger outputs info, warn, and error with formatted ISO timestamps", () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});

    logger.info("Test info message", { key: "value" });
    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls[0][0]).toContain(
      '[INFO] Test info message {"key":"value"}',
    );

    logger.warn("Test warn message");
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain("[WARN] Test warn message");

    const err = new Error("Something went wrong");
    logger.error("Test error message", err, { route: "/test" });
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toContain(
      "[ERROR] Test error message - Something went wrong",
    );
    expect(errorSpy.mock.calls[0][0]).toContain('{"route":"/test"}');

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("Bun HTTP app logs requests and handles 500 internal server errors", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const infoSpy = spyOn(console, "info").mockImplementation(() => {});
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    const app = createApp({
      extraRoutes: {
        "/api/test-error": () => {
          throw new Error("Triggered 500 error for testing");
        },
      },
    });

    const server = Bun.serve({ port: 0, routes: app.routes, fetch: app.fetch });
    const url = `http://127.0.0.1:${server.port}`;

    try {
      const res = await fetch(`${url}/api/test-error`);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toEqual({ error: "Triggered 500 error for testing" });

      expect(errorSpy).toHaveBeenCalled();
      const calls = errorSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(calls).toContain("Unhandled API error");
      expect(calls).toContain("Triggered 500 error for testing");
      expect(calls).toContain(" 500 - ");
    } finally {
      await server.stop(true);
      errorSpy.mockRestore();
      infoSpy.mockRestore();
      logSpy.mockRestore();
    }
  });
});
