import path from "node:path";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { apiRouter } from "./routes/api.routes.ts";

export function createExpressApp() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(process.cwd(), "public")));

  app.use("/api", apiRouter);

  // Global error middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: errMsg });
  });

  return app;
}
