import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isProd, safeRedirectPath } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const redirectTo = safeRedirectPath(
    request.nextUrl.searchParams.get("redirectTo")
  );

  if (!(userId && secret)) {
    return redirect("/auth/login?error=invalid_parameters");
  }

  const { account } = await createAdminClient();
  let session;
  try {
    session = await account.createSession(userId, secret);
  } catch (error) {
    console.error("Failed to create OAuth session:", error);
    return redirect("/auth/login?error=Login+failed");
  }

  (await cookies()).set("a_session_biso", session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: true,
    ...(isProd && { domain: ".biso.no" }),
  });

  return redirect(redirectTo);
}
