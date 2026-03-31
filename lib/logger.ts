// ═══════════════════════════════════════════════════════════════
// STRUCTURED LOGGER
// Timestamped, leveled logging with emoji prefixes for fast scanning
// ═══════════════════════════════════════════════════════════════

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "TRADE" | "SIGNAL";

const LEVEL_PREFIX: Record<LogLevel, string> = {
  DEBUG: "\x1b[90m[DBG]\x1b[0m",
  INFO: "\x1b[36m[INF]\x1b[0m",
  WARN: "\x1b[33m[WRN]\x1b[0m",
  ERROR: "\x1b[31m[ERR]\x1b[0m",
  TRADE: "\x1b[32m[TRD]\x1b[0m",
  SIGNAL: "\x1b[35m[SIG]\x1b[0m",
};

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").substring(0, 23);
}

function log(level: LogLevel, module: string, message: string, data?: unknown) {
  const prefix = LEVEL_PREFIX[level];
  const ts = timestamp();
  const line = `${ts} ${prefix} [${module}] ${message}`;

  if (level === "ERROR") {
    console.error(line, data ?? "");
  } else {
    console.log(line, data ? JSON.stringify(data, null, 0) : "");
  }
}

export const logger = {
  debug: (module: string, msg: string, data?: unknown) =>
    log("DEBUG", module, msg, data),
  info: (module: string, msg: string, data?: unknown) =>
    log("INFO", module, msg, data),
  warn: (module: string, msg: string, data?: unknown) =>
    log("WARN", module, msg, data),
  error: (module: string, msg: string, data?: unknown) =>
    log("ERROR", module, msg, data),
  trade: (module: string, msg: string, data?: unknown) =>
    log("TRADE", module, msg, data),
  signal: (module: string, msg: string, data?: unknown) =>
    log("SIGNAL", module, msg, data),
};
