import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const redirectTo = request.nextUrl.searchParams.get("redirectTo");
  const _url = request.nextUrl.protocol + request.headers.get("host");

  const { account } = await createAdminClient();
  const session = await account.createSession(userId!, secret!);

  // Session logging for debugging
  console.debug?.("Session:", session);

  (await cookies()).set("a_session_biso", session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: true,
  });

  // Redirect to the original destination if available
  if (redirectTo) {
    return redirect(decodeURIComponent(redirectTo));
  }

  // Default redirect
  return redirect("/admin");
}
