import { type NextRequest, NextResponse } from "next/server";
import { GRAPH_USERINFO_ENDPOINT, vouchForBiEmail } from "@/lib/bi-userinfo";

export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "no-store" };

/**
 * OIDC userinfo for Appwrite's BI provider. Configure it in the Appwrite
 * console as the provider's userinfo endpoint; see `@/lib/bi-userinfo` for
 * why it exists and why it is safe to expose.
 */
export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json(
      { error: "missing_token" },
      { headers: NO_STORE, status: 401 }
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(GRAPH_USERINFO_ENDPOINT, {
      cache: "no-store",
      headers: { accept: "application/json", authorization },
    });
  } catch (error) {
    console.error("[bi-userinfo] Microsoft userinfo unreachable:", error);
    return NextResponse.json(
      { error: "userinfo_unavailable" },
      { headers: NO_STORE, status: 502 }
    );
  }

  if (!upstream.ok) {
    // Microsoft's own 401 (expired or foreign token) is passed through so
    // Appwrite reports the sign-in as failed; anything else is an outage.
    const status = upstream.status === 401 ? 401 : 502;
    return NextResponse.json(
      { error: "userinfo_failed" },
      { headers: NO_STORE, status }
    );
  }

  let claims: unknown;
  try {
    claims = await upstream.json();
  } catch {
    claims = null;
  }
  if (typeof claims !== "object" || claims === null) {
    return NextResponse.json(
      { error: "userinfo_failed" },
      { headers: NO_STORE, status: 502 }
    );
  }
  return NextResponse.json(vouchForBiEmail(claims as Record<string, unknown>), {
    headers: NO_STORE,
  });
}
