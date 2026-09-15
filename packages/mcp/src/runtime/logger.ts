/**
 * Structured logging to stderr.
 *
 * An MCP stdio server owns stdout: every byte on it must be a framed JSON-RPC
 * message. A stray `console.log` anywhere in the import graph corrupts the
 * stream and the client disconnects with a parse error that gives no hint
 * where it came from. So this module writes only to stderr, and the stdio
 * entry point additionally redirects `console.*` here — see `bin/stdio.ts`.
 */

import type { LogLevel } from "../config/env";
import { redactSecrets } from "./redact";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

export interface Logger {
  /** A logger that stamps every line with additional fields. */
  child(fields: Record<string, unknown>): Logger;
  debug(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
}

export interface LoggerOptions {
  level: LogLevel;
  /** Defaults to stderr. Tests pass a collector. */
  write?: (line: string) => void;
}

function writeStderr(line: string): void {
  process.stderr.write(`${line}\n`);
}

export function createLogger(options: LoggerOptions): Logger {
  const threshold = LEVEL_ORDER[options.level];
  const write = options.write ?? writeStderr;

  const build = (bound: Record<string, unknown>): Logger => {
    const emit = (
      level: Exclude<LogLevel, "silent">,
      message: string,
      fields?: Record<string, unknown>
    ) => {
      if (LEVEL_ORDER[level] < threshold) {
        return;
      }
      const record = {
        ts: new Date().toISOString(),
        level,
        msg: message,
        ...bound,
        ...(fields ?? {}),
      };
      try {
        write(JSON.stringify(redactSecrets(record)));
      } catch {
        // Logging must never take the server down. A value that will not
        // serialise is dropped rather than thrown.
        write(
          JSON.stringify({
            ts: new Date().toISOString(),
            level,
            msg: message,
            note: "fields omitted (not serialisable)",
          })
        );
      }
    };

    return {
      debug: (message, fields) => emit("debug", message, fields),
      info: (message, fields) => emit("info", message, fields),
      warn: (message, fields) => emit("warn", message, fields),
      error: (message, fields) => emit("error", message, fields),
      child: (fields) => build({ ...bound, ...fields }),
    };
  };

  return build({});
}

/** A logger that discards everything. Used by tests that assert on results. */
export const silentLogger: Logger = createLogger({
  level: "silent",
  write: () => {
    /* discard */
  },
});
