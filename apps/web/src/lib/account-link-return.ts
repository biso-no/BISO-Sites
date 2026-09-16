export type AccountLinkError = "already_linked";

export interface AccountLinkReturn {
  error: AccountLinkError | null;
  isReturnLeg: boolean;
}

/**
 * Reads a BI link return leg off the query string.
 *
 * `/api/auth/bi-link` sends the browser back with `?linked=1`, or with
 * `?link_error=already_linked` when the link was refused. Both end the flow,
 * so both must close the browser-side Appwrite session the link opened.
 */
export function readAccountLinkReturn(params: {
  get(name: string): string | null;
}): AccountLinkReturn {
  const error =
    params.get("link_error") === "already_linked" ? "already_linked" : null;
  return { error, isReturnLeg: params.get("linked") === "1" || error !== null };
}
