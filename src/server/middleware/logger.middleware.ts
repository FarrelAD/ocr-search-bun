import { logger } from "../../utils/logger.ts";

export function logRequest(
  method: string,
  url: string,
  statusCode: number,
  durationMs: string | number,
): void {
  const message = `[${method}] ${url} ${statusCode} - ${durationMs}ms`;
  if (statusCode >= 500) {
    logger.error(message);
  } else if (statusCode >= 400) {
    logger.warn(message);
  } else {
    logger.info(message);
  }
}

export function logError(err: unknown, method: string, url: string): void {
  logger.error("Unhandled API error", err, {
    method,
    url,
  });
}
