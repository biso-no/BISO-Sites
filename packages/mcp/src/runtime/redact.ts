/**
 * Redaction.
 *
 * Two distinct jobs, deliberately separated:
 *
 * 1. `redactSecrets` — a last-resort scrub applied to everything that leaves
 *    the process (logs, audit records, error payloads). It is a safety net for
 *    values that reached a string by accident, not a licence to pass secrets
 *    around and clean them up later.
 *
 * 2. `SENSITIVE_COLUMNS` — an allowlist-by-exclusion applied when projecting
 *    Appwrite rows. Some columns are never appropriate in a model's context
 *    regardless of the caller's permissions: `user.bank_account` and
 *    `user.swift` are payout details, `expense.bank_account` likewise, and
 *    `expense_approvals.token_hash` is a bearer credential. A campus admin may
 *    legitimately read the row; the model still has no reason to see them.
 */

import { createHash } from "node:crypto";

/**
 * Columns stripped from every projected row, keyed by table.
 *
 * `*` applies to all tables.
 */
export const SENSITIVE_COLUMNS: Record<string, readonly string[]> = {
  "*": ["password", "secret", "token", "apiKey", "api_key"],
  user: ["bank_account", "swift"],
  expense: ["bank_account"],
  expense_approvals: [
    "token_hash",
    "teams_conversation_id",
    "teams_activity_id",
  ],
  recruitment_booking_tokens: ["token_hash"],
  payment_settings: [
    "vipps_client_secret",
    "vipps_subscription_key",
    "stripe_secret_key",
    "stripe_webhook_secret",
    "webhook_secret",
  ],
  orders: ["payment_session_id", "payment_link"],
  varsling_settings: ["email"],
};

/**
 * Remove sensitive columns from a row projection.
 *
 * Always applied at the service layer, so no tool can forget it.
 */
export function stripSensitive<T extends Record<string, unknown>>(
  table: string,
  row: T
): Record<string, unknown> {
  const drop = new Set([
    ...(SENSITIVE_COLUMNS["*"] ?? []),
    ...(SENSITIVE_COLUMNS[table] ?? []),
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!drop.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

const REDACTED = "[redacted]";

/**
 * Patterns for values that must never appear in output.
 *
 * Top-level literals, per the repo's "no regex construction in a loop" rule.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  // Appwrite / generic bearer tokens in a header-ish position.
  /\b(?:bearer|x-appwrite-key|x-appwrite-session|x-appwrite-jwt)\s*[:=]\s*\S+/gi,
  // JWTs: three base64url segments.
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
  // OpenAI-style keys.
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  // Stripe keys.
  /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}\b/g,
  // `key=value` where the key names a secret.
  /\b(?:api[_-]?key|client[_-]?secret|password|secret|session|jwt|token)\s*[:=]\s*["']?[A-Za-z0-9._\-/+]{8,}["']?/gi,
];

/** Scrub secret-shaped substrings from a string. */
export function redactString(value: string): string {
  let out = value;
  for (const pattern of SECRET_PATTERNS) {
    // `lastIndex` persists on a global regex reused across calls.
    pattern.lastIndex = 0;
    out = out.replace(pattern, REDACTED);
  }
  return out;
}

const MAX_DEPTH = 8;

/**
 * Recursively scrub a value destined for a log, an audit record or an error
 * payload. Keys that name a secret are dropped entirely rather than scrubbed,
 * because the key alone tells the reader what was there.
 */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) {
    return "[truncated]";
  }
  if (typeof value === "string") {
    return redactString(value);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, depth + 1));
  }
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = redactSecrets(item, depth + 1);
  }
  return out;
}

const SECRET_KEY_PATTERN =
  /^(?:.*_)?(?:password|secret|token|jwt|apikey|api_key|session|authorization|bank_account|swift)$/i;

function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

/**
 * A stable, non-reversible fingerprint for correlating a value across log lines
 * without disclosing it. Deliberately short — this is for reading in a
 * terminal, not for verification.
 */
export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}
