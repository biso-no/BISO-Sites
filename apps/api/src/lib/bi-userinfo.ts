/**
 * The userinfo endpoint Appwrite's OIDC provider is pointed at for BI sign-in.
 *
 * Appwrite's generic OIDC adapter trusts an email only when userinfo says
 * `email_verified`, and Microsoft Entra never sends that claim. Without it,
 * Appwrite refuses to sign a BI student into the account that already holds
 * their bi.no address and insists on a separate "link" step. This endpoint
 * forwards Appwrite's bearer token to Microsoft's own userinfo endpoint and
 * returns the same claims with `email_verified` set for a bi.no address.
 *
 * That is sound because the token never comes from the caller: Appwrite
 * fetches it from BI's tenant itself and only then calls here, and Microsoft
 * answers for the account that token belongs to. A stranger calling this
 * route with their own token learns nothing but their own claims.
 */

export const GRAPH_USERINFO_ENDPOINT =
  "https://graph.microsoft.com/oidc/userinfo";

const BI_EMAIL_DOMAIN = "bi.no";

/** Whether an address is issued by BI's tenant: exactly `@bi.no`, any local part. */
export function isBiEmail(email: unknown): email is string {
  if (typeof email !== "string") {
    return false;
  }
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return at > 0 && normalized.slice(at + 1) === BI_EMAIL_DOMAIN;
}

/**
 * The userinfo claims as Appwrite should see them. The email is lowercased
 * too: Appwrite stores emails lowercased and matches the merge exactly, so a
 * mixed-case address from Microsoft would miss the account it belongs to.
 */
export function vouchForBiEmail(
  claims: Record<string, unknown>
): Record<string, unknown> {
  const email = claims.email;
  const verified = isBiEmail(email);
  return {
    ...claims,
    email: verified ? email.trim().toLowerCase() : email,
    email_verified: verified,
  };
}
