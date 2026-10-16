/**
 * Every reason a BI sign-in can fail to connect the student. Mirrors the
 * failure codes of the identity sync except `directory_unavailable`, which
 * is a partial success (the student number landed, only the directory
 * enrichment failed) and so returns as `?linked=1`.
 */
export const ACCOUNT_LINK_ERRORS = [
  "already_linked",
  "invalid_bi_email",
  "no_bi_identity",
  "not_authenticated",
  "sync_failed",
] as const;

export type AccountLinkError = (typeof ACCOUNT_LINK_ERRORS)[number];

const ACCOUNT_LINK_ERROR_SET: ReadonlySet<string> = new Set(
  ACCOUNT_LINK_ERRORS
);

export function isAccountLinkError(value: unknown): value is AccountLinkError {
  return typeof value === "string" && ACCOUNT_LINK_ERROR_SET.has(value);
}

export interface AccountLinkReturn {
  error: AccountLinkError | null;
  isReturnLeg: boolean;
}

/**
 * Reads a BI sign-in's outcome off the query string.
 *
 * `/auth/oauth` sends the browser on with `?linked=1` when the student was
 * connected, or with `?link_error=<code>` when that was refused or failed.
 * Unknown codes are ignored so arbitrary query strings can't drive the UI.
 */
export function readAccountLinkReturn(params: {
  get(name: string): string | null;
}): AccountLinkReturn {
  const raw = params.get("link_error");
  const error = isAccountLinkError(raw) ? raw : null;
  return { error, isReturnLeg: params.get("linked") === "1" || error !== null };
}
