import path from "node:path";
import express from "express";
import {
  errorLoggerMiddleware,
  requestLoggerMiddleware,
} from "./middleware/logger.middleware.ts";
import { apiRouter } from "./routes/api.routes.ts";

export function createExpressApp() {
  const app = express();

  app.use(requestLoggerMiddleware);

  app.use(express.json());
  app.use(express.static(path.join(process.cwd(), "public")));

  app.use("/api", apiRouter);

  // Global error middleware
  app.use(errorLoggerMiddleware);

  return app;
}
