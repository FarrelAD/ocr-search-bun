function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return ` ${String(meta)}`;
  }
}

function formatError(error?: unknown): string {
  if (error === undefined || error === null) return "";
  if (error instanceof Error) {
    const stack = error.stack ? `\n${error.stack}` : "";
    return ` - ${error.message}${stack}`;
  }
  return ` - ${String(error)}`;
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    const metaStr = formatMeta(meta);
    console.log(`[${formatTimestamp()}] [INFO] ${message}${metaStr}`);
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    const metaStr = formatMeta(meta);
    console.warn(`[${formatTimestamp()}] [WARN] ${message}${metaStr}`);
  },

  error(
    message: string,
    error?: unknown,
    meta?: Record<string, unknown>,
  ): void {
    const metaStr = formatMeta(meta);
    const errStr = formatError(error);
    console.error(
      `[${formatTimestamp()}] [ERROR] ${message}${errStr}${metaStr}`,
    );
  },
};
