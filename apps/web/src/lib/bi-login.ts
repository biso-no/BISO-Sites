/**
 * The BI student sign-in's query-string contract, shared by the server
 * action that starts it, the login page that reports a failure, and the OAuth
 * return route that decides where a fresh session lands.
 */

/** Marks the login page as the failure leg of a BI sign-in. */
export const BI_LOGIN_FAILED_PARAM = "bi_login";
export const BI_LOGIN_FAILED_VALUE = "failed";

export type BiLoginFailure =
  /** Appwrite found an account with the same bi.no email but no BI identity. */
  | "existing_account"
  /** Any other provider or Appwrite failure, including a cancelled consent. */
  | "failed";

/**
 * Appwrite appends `error` as a JSON object `{ message, type, code }` to the
 * failure URL. The generic OIDC adapter cannot vouch for an email, so an
 * account that already holds the student's bi.no address without a BI
 * identity is refused as `general_bad_request`; that case gets its own
 * guidance because the student can fix it themselves.
 */
export function readBiLoginFailure(params: {
  get(name: string): string | null;
}): BiLoginFailure | null {
  if (params.get(BI_LOGIN_FAILED_PARAM) !== BI_LOGIN_FAILED_VALUE) {
    return null;
  }
  const raw = params.get("error");
  if (!raw) {
    return "failed";
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const type =
      typeof parsed === "object" && parsed !== null && "type" in parsed
        ? (parsed as { type?: unknown }).type
        : undefined;
    return type === "general_bad_request" ? "existing_account" : "failed";
  } catch {
    return "failed";
  }
}

/**
 * Where the OAuth return route sends a session it has just created.
 *
 * A student whose profile row did not exist before this sign-in is new to
 * the site and goes through onboarding; `linked=1` tells the flow the BI
 * step is already done. Everyone else lands where they were headed.
 */
export function oauthReturnDestination(input: {
  hadProfile: boolean;
  linkedBi: boolean;
  redirectTo: string;
}): string {
  if (input.hadProfile) {
    return input.redirectTo;
  }
  return input.linkedBi ? "/onboarding?linked=1" : "/onboarding";
}
