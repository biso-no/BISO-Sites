/**
 * The OpenID discovery document Appwrite's BI provider is pointed at.
 *
 * The Appwrite console only takes a well-known URL for an OIDC provider and
 * discovers the authorize, token and userinfo endpoints from it. To make
 * Appwrite call this project's userinfo route (see `./bi-userinfo`), the
 * provider's well-known URL is this project's own discovery route, which
 * serves Microsoft's document for BI's tenant with one field changed.
 */

const MULTI_TENANT_SEGMENTS = ["/common/", "/organizations/", "/consumers/"];

export interface DiscoveryDocument extends Record<string, unknown> {
  authorization_endpoint: string;
  token_endpoint: string;
}

export function isDiscoveryDocument(
  value: unknown
): value is DiscoveryDocument {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const doc = value as Record<string, unknown>;
  return (
    typeof doc.authorization_endpoint === "string" &&
    typeof doc.token_endpoint === "string"
  );
}

/**
 * Whether the document belongs to one tenant. The userinfo route vouches for
 * any `@bi.no` address, which is only safe when every token comes from BI's
 * own tenant; a `/common` or `/organizations` authority would let another
 * tenant's admin mint a user whose `mail` reads `x@bi.no`.
 */
export function isTenantSpecific(doc: DiscoveryDocument): boolean {
  return !MULTI_TENANT_SEGMENTS.some(
    (segment) =>
      doc.authorization_endpoint.includes(segment) ||
      doc.token_endpoint.includes(segment)
  );
}

/** Microsoft's document with the userinfo endpoint swapped for ours. */
export function rewriteDiscovery(
  doc: DiscoveryDocument,
  userinfoEndpoint: string
): DiscoveryDocument {
  return { ...doc, userinfo_endpoint: userinfoEndpoint };
}
