import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { redirect } from "next/navigation";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const redirectTo = request.nextUrl.searchParams.get("redirectTo");
  const url = request.nextUrl.protocol + request.headers.get('host');
  
  if (!userId || !secret) {
    return redirect('/auth/login?error=invalid_parameters');
  }

  const { account } = await createAdminClient();
  const session = await account.createSession(userId, secret);

  const fetchedCookies = await cookies();

  fetchedCookies.set("a_session_biso", session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });

  // Redirect to the original destination if available
  if (redirectTo) {
    return redirect(decodeURIComponent(redirectTo));
  }

  // Default redirect to homepage
  return redirect('/');
}
