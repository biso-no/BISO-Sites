import { NextRequest, NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

const NEXT_PUBLIC_APPWRITE_ENDPOINT = process.env.NEXT_PUBLIC_NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = "biso"
const API_KEY = process.env.NEXT_PUBLIC_APPWRITE_API_KEY;

// Cookie name mapping
const COOKIE_NAME_MAP = {
  'a_session_biso': 'a_session_biso'
};

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const membershipId = request.nextUrl.searchParams.get("membershipId");
  const teamId = request.nextUrl.searchParams.get("teamId");

  const origin = "https://app.biso.no"

  if (!userId || !secret || !membershipId || !teamId) {
    return redirect('/auth/login?error=invalid_parameters')
  }

  try {
    const response = await fetch(
      `${NEXT_PUBLIC_APPWRITE_ENDPOINT}/teams/${teamId}/memberships/${membershipId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': PROJECT_ID,
          'X-Appwrite-Key': API_KEY,
        },
        body: JSON.stringify({
          userId,
          secret,
        }),
      }
    );

    if (!response.ok) {
      console.error('Failed to accept invitation:', await response.text());
      return redirect('/auth/login?error=invitation_failed')
    }

    // Create response with redirect
    const redirectResponse = NextResponse.redirect(origin)

    // Extract cookies from response headers
    const setCookieHeader = response.headers.get('Set-Cookie');
    const fallbackCookies = response.headers.get('X-Fallback-Cookies');

    if (setCookieHeader) {
      // Parse and set the cookies from Set-Cookie header
      const cookiesList = setCookieHeader.split(',').map(cookie => cookie.trim());
      for (const cookieStr of cookiesList) {
        // Extract the cookie name and value
        const [cookiePart] = cookieStr.split(';');
        const [name, value] = cookiePart.split('=');
        
        // Use mapped name if exists, otherwise use original name
        const mappedName = COOKIE_NAME_MAP[name] || name;
        
        redirectResponse.cookies.set(mappedName, value, {
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: true,
        });
      }
    } else if (fallbackCookies) {
      // Parse and set cookies from X-Fallback-Cookies
      try {
        const fallbackCookiesObj = JSON.parse(fallbackCookies);
        for (const [name, value] of Object.entries(fallbackCookiesObj)) {
          // Use mapped name if exists, otherwise use original name
          const mappedName = COOKIE_NAME_MAP[name] || name;
          
          redirectResponse.cookies.set(mappedName, value as string, {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: true,
          });
        }
      } catch (e) {
        console.error('Failed to parse fallback cookies:', e);
      }
    }

    return redirectResponse;
  } catch (error) {
    console.error('Error handling team invitation:', error);
    return NextResponse.redirect(new URL('/auth/login?error=unexpected_error', origin));
  }
}