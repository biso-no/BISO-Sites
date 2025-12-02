import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { ID, MessagingProviderType } from "@repo/api";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const secret = request.nextUrl.searchParams.get("secret");
  const redirectTo = request.nextUrl.searchParams.get("redirectTo");
  const _url = request.nextUrl.protocol + request.headers.get("host");

  if (!(userId && secret)) {
    return redirect("/auth/login?error=invalid_parameters");
  }

  const { account, users } = await createAdminClient();
  const session = await account.createSession(userId, secret);

  console.log("User ID: ", session.userId);
  const user = await users.get(session.userId);

  const existingTargets = user.targets;
  console.log("Existing targets: ", existingTargets);
  const emailTarget = existingTargets.find((target) => target.providerType === MessagingProviderType.Email);

  if (!emailTarget) {
    console.log("Creating email target");
    await users.createTarget({
      userId,
      providerType: MessagingProviderType.Email,
      identifier: user.email,
      targetId: ID.unique(),
      name: "User email",
      providerId: 'email'
    });
  }

  const fetchedCookies = await cookies();
  console.log("Setting cookies");
  const setCookie = fetchedCookies.set("a_session_biso", session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: "none",
    secure: true,
    domain: ".biso.no",
  });

  console.log("Redirecting");
  // Redirect to the original destination if available
  if (redirectTo) {
    return redirect(decodeURIComponent(redirectTo));
  }

  // Default redirect to homepage
  return redirect("/");
}
