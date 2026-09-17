import type { NextFunction, Request, Response } from "express";
import { logger } from "../../utils/logger.ts";

export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = performance.now();
  res.on("finish", () => {
    const duration = (performance.now() - start).toFixed(2);
    const url = req.originalUrl || req.url;
    const message = `[${req.method}] ${url} ${res.statusCode} - ${duration}ms`;
    if (res.statusCode >= 500) {
      logger.error(message);
    } else if (res.statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });
  next();
}

export function errorLoggerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  logger.error("Unhandled API error", err, {
    method: req.method,
    url: req.originalUrl || req.url,
  });
  const errMsg = err instanceof Error ? err.message : String(err);
  res.status(500).json({ error: errMsg });
}
