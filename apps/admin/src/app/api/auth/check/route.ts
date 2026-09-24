import { type NextRequest, NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth-utils";

export async function GET(_request: NextRequest) {
  try {
    const authStatus = await getAuthStatus();

    return NextResponse.json(authStatus, {
      status: 200,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    // getAuthStatus only throws when the auth backend itself failed (a missing
    // or rejected session resolves to logged-out). Report "unknown" as 503 so
    // clients don't treat an outage as a sign-out.
    console.error("Error checking authentication status:", error);

    return NextResponse.json(
      { error: "Failed to check authentication status" },
      {
        status: 503,
        headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
      }
    );
  }
}
