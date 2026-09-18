/**
 * The error taxonomy.
 *
 * Callers need to tell these apart, and collapsing them is how an MCP server
 * misleads a model: "no results" read as "forbidden" makes it give up on a
 * legitimate search, and "forbidden" read as "needs approval" makes it file an
 * approval request that nobody can grant. Each code below means exactly one
 * thing and carries the information needed to act on it.
 */

export const ERROR_CODES = [
  /** The query ran and matched nothing. Not an error about permission. */
  "no_results",
  /** The caller is authenticated but not permitted. Retrying will not help. */
  "forbidden",
  /** No verified identity at all — the server has no user credential. */
  "unauthenticated",
  /** The row/document does not exist, or is outside the caller's scope. */
  "not_found",
  /** The arguments failed validation. The message names the field. */
  "invalid_input",
  /** The document changed since the revision the caller supplied. */
  "stale_revision",
  /**
   * A dependency this capability needs is not configured or not reachable.
   * Distinct from `forbidden`: nobody is permitted to use it right now.
   */
  "unavailable",
  /** The operation is understood and permitted, but this build cannot run it. */
  "not_supported",
  /** An external system rejected the action definitively. */
  "external_failed",
  /**
   * An external action was attempted and its outcome is genuinely unknown
   * (timeout, transport failure). Never retried automatically.
   */
  "external_uncertain",
  /** A write was requested in a mode that only produces proposals. */
  "requires_authorization",
  /** The backend took too long. */
  "timeout",
  /** Anything unclassified. */
  "internal",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface DomainErrorDetails {
  /** Machine-readable specifics. Must already be redaction-safe. */
  [key: string]: unknown;
}

/**
 * The only error type tools are expected to throw.
 *
 * Anything else that escapes a tool is treated as `internal` and its message is
 * NOT surfaced, because an unexpected error can carry a connection string, a
 * token or a row the caller may not read.
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details: DomainErrorDetails;
  /** A short, concrete next step, when one exists. */
  readonly remedy: string | null;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      details?: DomainErrorDetails;
      remedy?: string;
      cause?: unknown;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "DomainError";
    this.code = code;
    this.details = options.details ?? {};
    this.remedy = options.remedy ?? null;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export const forbidden = (
  message: string,
  details?: DomainErrorDetails,
  remedy?: string
) => new DomainError("forbidden", message, { details, remedy });

export const notFound = (message: string, details?: DomainErrorDetails) =>
  new DomainError("not_found", message, { details });

export const invalidInput = (message: string, details?: DomainErrorDetails) =>
  new DomainError("invalid_input", message, { details });

export const unavailable = (
  message: string,
  details?: DomainErrorDetails,
  remedy?: string
) => new DomainError("unavailable", message, { details, remedy });

export const notSupported = (message: string, details?: DomainErrorDetails) =>
  new DomainError("not_supported", message, { details });

export const staleRevision = (message: string, details?: DomainErrorDetails) =>
  new DomainError("stale_revision", message, {
    details,
    remedy:
      "Re-read the document and re-apply the change to the current revision.",
  });

export const unauthenticated = (message: string) =>
  new DomainError("unauthenticated", message, {
    remedy:
      "Start the server with BISO_MCP_APPWRITE_JWT or BISO_MCP_APPWRITE_SESSION set to a credential for the acting user.",
  });

export const requiresAuthorization = (
  message: string,
  details?: DomainErrorDetails,
  remedy?: string
) => new DomainError("requires_authorization", message, { details, remedy });

/**
 * Translate an Appwrite exception into the taxonomy.
 *
 * Appwrite's own message is kept only for the statuses where it is safe and
 * useful (4xx describing the request). A 5xx message can name internal hosts,
 * so it is replaced.
 */
export function fromAppwriteError(
  error: unknown,
  context: { operation: string }
): DomainError {
  const status = (error as { code?: unknown } | null)?.code;
  const type = (error as { type?: unknown } | null)?.type;
  const message =
    typeof (error as { message?: unknown } | null)?.message === "string"
      ? ((error as { message: string }).message satisfies string)
      : "Unknown backend error";

  if (type === "appwrite_timeout" || status === 504) {
    return new DomainError(
      "timeout",
      `The backend did not respond in time (${context.operation}).`,
      { details: { operation: context.operation }, cause: error }
    );
  }
  if (status === 401 || status === 403) {
    return new DomainError(
      "forbidden",
      `The backend refused this operation (${context.operation}).`,
      { details: { operation: context.operation }, cause: error }
    );
  }
  if (status === 404) {
    return new DomainError("not_found", `Not found (${context.operation}).`, {
      details: { operation: context.operation },
      cause: error,
    });
  }
  if (status === 409) {
    return new DomainError(
      "stale_revision",
      `The backend reported a conflict (${context.operation}).`,
      { details: { operation: context.operation }, cause: error }
    );
  }
  if (typeof status === "number" && status >= 400 && status < 500) {
    return new DomainError("invalid_input", message, {
      details: { operation: context.operation, status },
      cause: error,
    });
  }
  // No numeric status means no HTTP response arrived at all — a reset socket,
  // a dropped connection, a DNS failure. That is materially different from a
  // 5xx, where the backend answered: the request may have reached Appwrite and
  // been applied in full, with only the reply lost. Tagged here so the one
  // caller that knows a *write* was in flight can say so; every other caller
  // treats it as the plain failure it looks like.
  const transport = typeof status !== "number";
  return new DomainError(
    "internal",
    `The backend failed (${context.operation}).`,
    {
      details: transport
        ? { operation: context.operation, transport: true }
        : { operation: context.operation, status },
      cause: error,
    }
  );
}

/**
 * Whether this error means "no response arrived", as opposed to "the backend
 * said no".
 *
 * Only meaningful once a request has actually been dispatched.
 */
export function isTransportFailure(error: unknown): boolean {
  return (
    isDomainError(error) &&
    error.code === "internal" &&
    error.details.transport === true
  );
}
