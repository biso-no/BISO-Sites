import { type NextRequest, NextResponse } from "next/server";
import {
  isDiscoveryDocument,
  isTenantSpecific,
  rewriteDiscovery,
} from "@/lib/bi-oidc-discovery";
import { apiBaseUrl } from "@/lib/public-urls";

export const dynamic = "force-dynamic";

const CACHE_AN_HOUR = { "cache-control": "public, max-age=3600" };
const NO_STORE = { "cache-control": "no-store" };

/**
 * OpenID discovery for Appwrite's BI provider: set the provider's well-known
 * URL in the Appwrite console to this route. It serves Microsoft's document
 * for BI's tenant (`BI_OIDC_WELL_KNOWN_URL`) with the userinfo endpoint
 * pointed at `/api/auth/bi-userinfo`, which vouches for bi.no emails.
 */
export async function GET(request: NextRequest) {
  const upstreamUrl = process.env.BI_OIDC_WELL_KNOWN_URL?.trim();
  if (!upstreamUrl) {
    console.error("[bi-oidc] BI_OIDC_WELL_KNOWN_URL is not configured");
    return NextResponse.json(
      { error: "not_configured" },
      { headers: NO_STORE, status: 500 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
  } catch (error) {
    console.error("[bi-oidc] discovery document unreachable:", error);
    return NextResponse.json(
      { error: "discovery_unavailable" },
      { headers: NO_STORE, status: 502 }
    );
  }
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "discovery_failed" },
      { headers: NO_STORE, status: 502 }
    );
  }

  let doc: unknown;
  try {
    doc = await upstream.json();
  } catch {
    doc = null;
  }
  if (!isDiscoveryDocument(doc)) {
    return NextResponse.json(
      { error: "discovery_invalid" },
      { headers: NO_STORE, status: 502 }
    );
  }
  if (!isTenantSpecific(doc)) {
    // Refusing here is what keeps the bi.no vouching safe; see the helper.
    console.error(
      "[bi-oidc] BI_OIDC_WELL_KNOWN_URL must be BI's tenant-specific document, not /common or /organizations"
    );
    return NextResponse.json(
      { error: "discovery_not_tenant_specific" },
      { headers: NO_STORE, status: 500 }
    );
  }

  const origin = apiBaseUrl() ?? new URL(request.url).origin;
  return NextResponse.json(
    rewriteDiscovery(doc, `${origin}/api/auth/bi-userinfo`),
    { headers: CACHE_AN_HOUR }
  );
}
