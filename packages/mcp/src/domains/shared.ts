/**
 * Shared pieces for the tool modules: common input fields and small builders.
 *
 * The input fragments here exist so that pagination, locale and scope
 * arguments mean the same thing in every tool. A model that learns `limit` and
 * `cursor` once should not have to relearn them per domain.
 */

import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { PolicyProfile } from "../identity/principal";
import {
  type AppliedScope,
  clampLimit,
  decodeCursor,
  ok,
  type ToolOk,
} from "../runtime/result";

export const MAX_PAGE_SIZE = 100;

export const paginationInput = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .optional()
    .describe(
      `Maximum rows to return (1-${MAX_PAGE_SIZE}). Defaults to 20. Lists are always bounded.`
    ),
  cursor: z
    .string()
    .optional()
    .describe(
      "Opaque continuation cursor from a previous result's `pagination.nextCursor`."
    ),
};

export const localeInput = {
  locale: z
    .enum(["no", "en"])
    .optional()
    .describe(
      "Preferred locale for titles and summaries. Norwegian is the authoritative source; English is the translation. Defaults to `no`."
    ),
};

export function readPage(args: { limit?: number; cursor?: string }): {
  limit: number;
  offset: number;
} {
  return { limit: clampLimit(args.limit), offset: decodeCursor(args.cursor) };
}

/** Annotations for a tool that only reads. */
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: false,
};

/**
 * Annotations for a tool that reads through to an external provider.
 *
 * `openWorldHint` is true when the result depends on a system outside this
 * database, so a client knows the answer is not reproducible from Appwrite
 * alone.
 */
export const READ_ONLY_EXTERNAL: ToolAnnotations = {
  readOnlyHint: true,
  openWorldHint: true,
};

/** Annotations for a reversible, additive write. */
export const WRITE_ADDITIVE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

/** Annotations for a write that replaces state but does not delete anything. */
export const WRITE_IDEMPOTENT: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const ALL_PROFILES: readonly PolicyProfile[] = [
  "public",
  "member",
  "staff",
  "it-operator",
];

export const STAFF_PROFILES: readonly PolicyProfile[] = [
  "staff",
  "it-operator",
];

export const OPERATOR_PROFILES: readonly PolicyProfile[] = ["it-operator"];

/**
 * Whether this session's profile is a staff one.
 *
 * Registration already gates a tool by profile, so this is for the tools
 * registered for *every* profile that still owe a public caller a narrower
 * answer than a staff one — the unit lookups, which would otherwise hand a
 * signed-out caller the 24SevenOffice chart of accounts, and the permission
 * explainer, which must not describe tools that are not in the session.
 */
export function isStaffProfile(principal: { profile: PolicyProfile }): boolean {
  return STAFF_PROFILES.includes(principal.profile);
}

export const SIGNED_IN_PROFILES: readonly PolicyProfile[] = [
  "member",
  "staff",
  "it-operator",
];

/** Convenience builder so every handler returns the same envelope. */
export function result<T>(input: {
  requestId: string;
  summary: string;
  data: T;
  scope: AppliedScope;
  effect?: ToolOk<T>["effect"];
  pagination?: ToolOk<T>["pagination"];
  links?: Record<string, string>;
  warnings?: string[];
}): ToolOk<T> {
  return ok<T>(input);
}

/**
 * A request id for a handler.
 *
 * The registration wrapper already mints one for logging and audit; handlers
 * mint their own for the envelope so a result is self-describing even when a
 * service is exercised directly in a test.
 */
export function newRequestId(): string {
  return crypto.randomUUID();
}
