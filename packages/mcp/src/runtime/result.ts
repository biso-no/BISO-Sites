/**
 * The result envelope every tool returns.
 *
 * One shape for every tool, so a model never has to guess whether `rows`,
 * `data`, `items` or a bare array is what came back — which is exactly the
 * inconsistency the current admin assistant has, where `searchContent` returns
 * `.rows` for two domains and the raw action result for the rest.
 *
 * Every payload carries the scope it was resolved under. That is not decoration:
 * a model that cannot see "this list was filtered to campus 1" will report an
 * empty result as "there are none" instead of "there are none you can see".
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { type DomainError, isDomainError } from "./errors";
import { redactSecrets } from "./redact";

/** How a result's rows were scoped, for the model to quote back to the user. */
export interface AppliedScope {
  /** Campus ids the query was restricted to; empty means unrestricted. */
  campusIds: string[];
  /** Department ids the query was restricted to; empty means unrestricted. */
  departmentIds: string[];
  /** `global`, `campus`, `department` or `self`. */
  level: "global" | "campus" | "department" | "self" | "public";
  /** Human-readable summary, e.g. "Oslo (campus 1)". */
  summary: string;
}

export interface Pagination {
  /** Rows in this page. */
  count: number;
  /** True when `total` exceeds what has been returned so far. */
  hasMore: boolean;
  /** Opaque cursor for the next page, or null when the list is exhausted. */
  nextCursor: string | null;
  /** Total matching rows the backend reported, when it reports one. */
  total: number | null;
}

/**
 * What a successful call actually did to the backend.
 *
 * `proposed` is the important one: in the default `propose` write mode a
 * mutating tool validates the change, describes it and writes **nothing**, yet
 * still returns a successful result. Without this field that outcome is
 * indistinguishable from a completed write — to the model reading the result,
 * and to the `audit_logs` row derived from it.
 */
export type ToolEffect = "read" | "proposed" | "executed";

export interface ToolOk<T> {
  data: T;
  /** Defaults to `read` when a handler does not say otherwise. */
  effect?: ToolEffect;
  /** Deep links into the apps for anything referenced. */
  links?: Record<string, string>;
  ok: true;
  pagination?: Pagination;
  /** Correlates this result with the server's stderr log and audit record. */
  requestId: string;
  scope: AppliedScope;
  /** One sentence a model can relay verbatim. */
  summary: string;
  /** Non-fatal notes: a dropped optional filter, a partial provider result. */
  warnings?: string[];
}

export interface ToolErr {
  error: {
    code: DomainError["code"];
    message: string;
    details: Record<string, unknown>;
    /** A concrete next step when one exists. */
    remedy: string | null;
  };
  ok: false;
  requestId: string;
}

export type ToolOutcome<T> = ToolOk<T> | ToolErr;

export const PUBLIC_SCOPE: AppliedScope = {
  level: "public",
  campusIds: [],
  departmentIds: [],
  summary: "Published, publicly visible content only",
};

export function ok<T>(
  input: Omit<ToolOk<T>, "ok" | "requestId"> & { requestId: string }
): ToolOk<T> {
  return { ok: true, ...input };
}

/**
 * Render an outcome as an MCP `CallToolResult`.
 *
 * Both the text and the structured payload are emitted: `structuredContent` is
 * what a tool-aware client reads, `content` is the fallback for clients that
 * only render text. They are always derived from the same object so they can
 * never disagree.
 *
 * `isError` is set for failures so the client surfaces them as tool errors
 * rather than as a successful result that happens to contain the word "error".
 */
export function toCallToolResult(
  outcome: ToolOutcome<unknown>
): CallToolResult {
  const safe = redactSecrets(outcome) as Record<string, unknown>;
  return {
    content: [{ type: "text", text: JSON.stringify(safe, null, 2) }],
    structuredContent: safe,
    isError: outcome.ok !== true,
  };
}

/**
 * Convert any thrown value into a `ToolErr`.
 *
 * A `DomainError` keeps its code, message and remedy. Anything else is reported
 * as `internal` with a fixed message: an unexpected error can carry a token, a
 * connection string, or a row the caller is not allowed to read, and none of
 * that belongs in a model's context. The real error still reaches stderr.
 */
export function toToolError(error: unknown, requestId: string): ToolErr {
  if (isDomainError(error)) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        details: (redactSecrets(error.details) ?? {}) as Record<
          string,
          unknown
        >,
        remedy: error.remedy,
      },
      requestId,
    };
  }
  return {
    ok: false,
    error: {
      code: "internal",
      message:
        "The server hit an unexpected error. Details were written to the server log.",
      details: {},
      remedy: null,
    },
    requestId,
  };
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Clamp a caller-supplied limit. No tool ever returns an unbounded list. */
export function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
}

/**
 * Cursors are offset-based and opaque.
 *
 * Opaque so a caller cannot craft one that widens a query, and so the encoding
 * can change to a keyset cursor later without a schema change.
 */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString(
    "base64url"
  );
}

export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    );
    const offset = (parsed as { o?: unknown })?.o;
    if (typeof offset === "number" && Number.isFinite(offset) && offset >= 0) {
      return Math.trunc(offset);
    }
  } catch {
    // A malformed cursor restarts from the beginning rather than failing the
    // call: the caller gets correct data, just not the page they expected.
  }
  return 0;
}

export function buildPagination(input: {
  count: number;
  total: number | null;
  offset: number;
  limit: number;
}): Pagination {
  const consumed = input.offset + input.count;
  const hasMore =
    input.total === null ? input.count === input.limit : consumed < input.total;
  return {
    count: input.count,
    total: input.total,
    nextCursor: hasMore ? encodeCursor(consumed) : null,
    hasMore,
  };
}
