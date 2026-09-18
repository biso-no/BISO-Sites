/**
 * Server configuration.
 *
 * Everything the server needs arrives here, once, at startup. Nothing deeper in
 * the package reads `process.env` — that keeps the standalone binary, the
 * embedded factory and the tests on exactly one code path, and makes it
 * possible to state in one place which secrets exist.
 */

import { z } from "zod";

/**
 * What the server may do with a validated, authorized mutation.
 *
 * This is deliberately NOT "does the caller have permission" — that is decided
 * per call from the principal's own roles. This is the separate question of
 * whether a *human* has authorized this process to act on their behalf at all.
 * A model asserting `confirmed: true` is not an answer to it.
 *
 * - `propose` (default) — every mutating tool validates, resolves and diffs the
 *   change, then returns the proposal. Nothing is ever written.
 * - `confirm` — a proposal may be executed only after the MCP host returns an
 *   `accept` from an `elicitation/create` round-trip. A client that does not
 *   advertise the `elicitation` capability silently stays at `propose`.
 * - `operator` — the person running this process has accepted that it may
 *   write on their behalf without a per-call prompt. Still restricted to the
 *   reversible tiers; see `MUTATION_TIERS` in `../runtime/mutation.ts`.
 *
 * No mode enables the `restricted` tier (payments, refunds, ledger postings,
 * outbound messages, identity changes). Those need a persisted approval record
 * and are not executable from this package in this release.
 */
export const WRITE_MODES = ["propose", "confirm", "operator"] as const;
export type WriteMode = (typeof WRITE_MODES)[number];

export const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const DEFAULT_ENDPOINT = "https://appwrite.biso.no/v1";
const DEFAULT_PROJECT = "biso";
const DEFAULT_WEB_BASE_URL = "https://biso.no";
const DEFAULT_ADMIN_BASE_URL = "https://admin.biso.no";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_SLOW_MS = 2000;
const MIN_TIMEOUT_MS = 500;
const MAX_TIMEOUT_MS = 120_000;

const optionalString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .catch(undefined)
  .transform((value) => (value === "" ? undefined : value));

const boolish = (fallback: boolean) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (value === undefined || value === "") {
        return fallback;
      }
      return value.toLowerCase() === "true" || value === "1";
    });

const positiveInt = (fallback: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) {
        return fallback;
      }
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
      }
      return Math.min(Math.max(parsed, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
    });

const rawEnvSchema = z.object({
  BISO_MCP_APPWRITE_ENDPOINT: optionalString,
  BISO_MCP_APPWRITE_PROJECT: optionalString,
  /** A JWT minted for one Appwrite user. Preferred: short-lived and revocable. */
  BISO_MCP_APPWRITE_JWT: optionalString,
  /** A raw Appwrite session secret. Equivalent authority, longer lived. */
  BISO_MCP_APPWRITE_SESSION: optionalString,
  /**
   * A service key. NOT an identity — see `resolvePrincipal`. It only ever acts
   * as an elevated executor for an operation the principal already passed.
   */
  BISO_MCP_APPWRITE_API_KEY: optionalString,
  BISO_MCP_WRITE_MODE: optionalString,
  BISO_MCP_LOG_LEVEL: optionalString,
  BISO_MCP_REQUEST_TIMEOUT_MS: positiveInt(DEFAULT_TIMEOUT_MS),
  BISO_MCP_SLOW_REQUEST_MS: positiveInt(DEFAULT_SLOW_MS),
  BISO_MCP_WEB_BASE_URL: optionalString,
  BISO_MCP_ADMIN_BASE_URL: optionalString,
  /**
   * Opt-in for the optional AI tools. Absent means the AI-backed tools are not
   * registered at all and say so, rather than failing at call time.
   */
  OPENAI_API_KEY: optionalString,
  BISO_MCP_AI_ENABLED: boolish(true),
});

export interface ServerConfig {
  ai: {
    /**
     * True only when a provider key is configured AND the operator has not
     * turned AI off. Ordinary reads and writes never consult this.
     */
    enabled: boolean;
    apiKey: string | null;
  };
  appwrite: {
    endpoint: string;
    project: string;
    /** Present when a user credential was supplied. */
    userCredential:
      | { kind: "jwt"; jwt: string }
      | { kind: "session"; session: string }
      | null;
    /** Present when a service key was supplied. */
    apiKey: string | null;
    requestTimeoutMs: number;
    slowRequestMs: number;
  };
  links: {
    web: string;
    admin: string;
  };
  logLevel: LogLevel;
  writeMode: WriteMode;
}

function parseEnum<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  fallback: T[number]
): T[number] {
  if (value && (allowed as readonly string[]).includes(value)) {
    return value as T[number];
  }
  return fallback;
}

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * Build the configuration from an environment-like record.
 *
 * Takes the source explicitly so tests never mutate `process.env`.
 */
export function loadConfig(
  env: Record<string, string | undefined> = process.env
): ServerConfig {
  const parsed = rawEnvSchema.parse(env);

  let userCredential: ServerConfig["appwrite"]["userCredential"] = null;
  if (parsed.BISO_MCP_APPWRITE_JWT) {
    userCredential = { kind: "jwt", jwt: parsed.BISO_MCP_APPWRITE_JWT };
  } else if (parsed.BISO_MCP_APPWRITE_SESSION) {
    userCredential = {
      kind: "session",
      session: parsed.BISO_MCP_APPWRITE_SESSION,
    };
  }

  const aiKey = parsed.OPENAI_API_KEY ?? null;

  return {
    appwrite: {
      endpoint: stripTrailingSlash(
        parsed.BISO_MCP_APPWRITE_ENDPOINT ?? DEFAULT_ENDPOINT
      ),
      project: parsed.BISO_MCP_APPWRITE_PROJECT ?? DEFAULT_PROJECT,
      userCredential,
      apiKey: parsed.BISO_MCP_APPWRITE_API_KEY ?? null,
      requestTimeoutMs: parsed.BISO_MCP_REQUEST_TIMEOUT_MS,
      slowRequestMs: parsed.BISO_MCP_SLOW_REQUEST_MS,
    },
    writeMode: parseEnum(parsed.BISO_MCP_WRITE_MODE, WRITE_MODES, "propose"),
    logLevel: parseEnum(parsed.BISO_MCP_LOG_LEVEL, LOG_LEVELS, "info"),
    links: {
      web: stripTrailingSlash(
        parsed.BISO_MCP_WEB_BASE_URL ?? DEFAULT_WEB_BASE_URL
      ),
      admin: stripTrailingSlash(
        parsed.BISO_MCP_ADMIN_BASE_URL ?? DEFAULT_ADMIN_BASE_URL
      ),
    },
    ai: {
      enabled: parsed.BISO_MCP_AI_ENABLED && aiKey !== null,
      apiKey: aiKey,
    },
  };
}

/**
 * A description of the configuration that is safe to return to a model.
 *
 * Reports whether each credential is present, never any part of its value.
 */
export function describeConfig(config: ServerConfig): Record<string, unknown> {
  return {
    endpoint: config.appwrite.endpoint,
    project: config.appwrite.project,
    identity: config.appwrite.userCredential
      ? `configured (${config.appwrite.userCredential.kind})`
      : "none",
    serviceKey: config.appwrite.apiKey ? "configured" : "none",
    writeMode: config.writeMode,
    aiProvider: config.ai.enabled ? "configured" : "unavailable",
    requestTimeoutMs: config.appwrite.requestTimeoutMs,
  };
}
