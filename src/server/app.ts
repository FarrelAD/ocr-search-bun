import path from "node:path";
import type {
  AppOptions,
  RouteHandler,
  RouteTarget,
} from "../types/server.types.ts";
import { logError, logRequest } from "./middleware/logger.middleware.ts";
import { createApiRoutes } from "./routes/api.routes.ts";

export function withLogging(handler: RouteHandler): RouteHandler {
  return async (req: Request): Promise<Response> => {
    const start = performance.now();
    const url = new URL(req.url);
    let res: Response;

    try {
      res = await handler(req);
    } catch (err) {
      logError(err, req.method, req.url);
      const errMsg = err instanceof Error ? err.message : String(err);
      res = Response.json({ error: errMsg }, { status: 500 });
    }

    const duration = (performance.now() - start).toFixed(2);
    const urlPathAndQuery = url.pathname + url.search;
    logRequest(req.method, urlPathAndQuery, res.status, duration);

    return res;
  };
}

export function wrapRoutes(
  routes: Record<string, RouteTarget>,
): Record<string, RouteTarget> {
  const wrapped: Record<string, RouteTarget> = {};

  for (const [key, target] of Object.entries(routes)) {
    if (typeof target === "function") {
      wrapped[key] = withLogging(target);
    } else if (target instanceof Response) {
      wrapped[key] = target;
    } else if (typeof target === "object" && target !== null) {
      if ("dir" in target && typeof target.dir === "string") {
        wrapped[key] = target;
      } else {
        const methodMap: Record<string, RouteHandler> = {};
        for (const [method, handler] of Object.entries(target)) {
          if (typeof handler === "function") {
            methodMap[method] = withLogging(handler as RouteHandler);
          }
        }
        wrapped[key] = methodMap;
      }
      wrapped[key] = target;
    }
  }

  return wrapped;
}

export function createApp(options?: AppOptions) {
  const publicDir = path.resolve(
    options?.publicDir || path.join(process.cwd(), "public"),
  );
  const uploadsDir = path.resolve(
    options?.uploadsDir || path.join(process.cwd(), "uploads"),
  );

  const rawRoutes: Record<string, RouteTarget> = {
    ...createApiRoutes(uploadsDir),
    ...(options?.extraRoutes || {}),
    "/*": { dir: publicDir },
  };

  const routes = wrapRoutes(rawRoutes);

  return {
    routes,
    fetch(req: Request): Response {
      const url = new URL(req.url);
      logRequest(req.method, url.pathname + url.search, 404, "0.00");
      return new Response("Not Found", { status: 404 });
    },
  };
}
