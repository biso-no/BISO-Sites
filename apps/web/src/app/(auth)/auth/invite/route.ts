import { redirect } from "next/navigation";
import { type NextRequest, NextResponse } from "next/server";
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/cookie-prefs";

// Server-only: APPWRITE_API_KEY must NOT use the NEXT_PUBLIC_ prefix or it
// would be bundled into every browser JS chunk.
const APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT || "biso";
const API_KEY = process.env.APPWRITE_API_KEY;

// Appwrite issues its session as `a_session_<projectId>`. We re-emit it under
// our own name so the browser never sends it back to appwrite.biso.no as if it
// were Appwrite's own cookie. See LEGACY_SESSION_COOKIE in `cookie-prefs.ts`.
const COOKIE_NAME_MAP: Record<string, string> = {
  [LEGACY_SESSION_COOKIE]: SESSION_COOKIE,
};

function setSessionCookie(response: NextResponse, name: string, value: string) {
  const mappedName = COOKIE_NAME_MAP[name] || name;
  response.cookies.set(mappedName, value, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });
}

function applySetCookieHeader(response: NextResponse, setCookieHeader: string) {
  const cookiesList = setCookieHeader.split(",").map((cookie) => cookie.trim());
  for (const cookieStr of cookiesList) {
    const [cookiePart] = cookieStr.split(";");
    const [name, value] = cookiePart.split("=");
    if (name && value) {
      setSessionCookie(response, name, value);
    }
  }
}

function applyFallbackCookies(response: NextResponse, fallbackCookies: string) {
  try {
    const fallbackCookiesObj = JSON.parse(fallbackCookies);
    for (const [name, value] of Object.entries(fallbackCookiesObj)) {
      if (typeof value === "string") {
        setSessionCookie(response, name, value);
      }
    }
  } catch (e) {
    console.error("Failed to parse fallback cookies:", e);
  }
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const membershipId = request.nextUrl.searchParams.get("membershipId");
  const teamId = request.nextUrl.searchParams.get("teamId");

  const origin = "https://app.biso.no";

  if (!(userId && secret && membershipId && teamId)) {
    return redirect("/auth/login?error=invalid_parameters");
  }
  if (!(APPWRITE_ENDPOINT && API_KEY)) {
    console.error("Appwrite invite configuration is missing");
    return redirect("/auth/login?error=server_configuration");
  }

  try {
    const response = await fetch(
      `${APPWRITE_ENDPOINT}/teams/${teamId}/memberships/${membershipId}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": PROJECT_ID,
          "X-Appwrite-Key": API_KEY,
        },
        body: JSON.stringify({
          userId,
          secret,
        }),
      }
    );

    if (!response.ok) {
      console.error("Failed to accept invitation:", await response.text());
      return redirect("/auth/login?error=invitation_failed");
    }

    // Create response with redirect
    const redirectResponse = NextResponse.redirect(origin);

    // Extract cookies from response headers
    const setCookieHeader = response.headers.get("Set-Cookie");
    const fallbackCookies = response.headers.get("X-Fallback-Cookies");

    if (setCookieHeader) {
      applySetCookieHeader(redirectResponse, setCookieHeader);
    } else if (fallbackCookies) {
      applyFallbackCookies(redirectResponse, fallbackCookies);
    }

    return redirectResponse;
  } catch (error) {
    console.error("Error handling team invitation:", error);
    return NextResponse.redirect(
      new URL("/auth/login?error=unexpected_error", origin)
    );
  }
}
