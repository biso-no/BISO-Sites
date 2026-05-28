import { ID, MessagingProviderType } from "@repo/api";
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

  const { account, users } = await createAdminClient();
  const session = await account.createSession(userId, secret);

  const user = await users.get(session.userId);

  const emailTarget = user.targets.find(
    (target) => target.providerType === MessagingProviderType.Email
  );

  if (!emailTarget) {
    await users.createTarget({
      userId,
      providerType: MessagingProviderType.Email,
      identifier: user.email,
      targetId: ID.unique(),
      name: "User email",
      providerId: "email",
    });
  }

  const fetchedCookies = await cookies();
  // Domain attribute is omitted in non-prod — "localhost" is not a valid
  // Domain= value and browsers drop the cookie when it's set.
  fetchedCookies.set("a_session_biso", session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: true,
    ...(isProd && { domain: ".biso.no" }),
  });

  return redirect(redirectTo);
}
