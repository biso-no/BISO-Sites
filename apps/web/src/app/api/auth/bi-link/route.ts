import { NextResponse } from "next/server";
import { syncBiStudentIdentity } from "@/lib/actions/bi-identity";

// Where Appwrite's OIDC "success" redirect is allowed to send the buyer back
// to after this route runs the sync. An open `returnTo` would let the OAuth
// success URL (attacker-controllable only insofar as they can start the OAuth
// flow with any success URL they like, since it's passed client-side) redirect
// anywhere; this route only ever forwards to one of the three pages that
// actually trigger a BI link.
const ALLOWED_RETURN_PATHS = new Set([
  "/membership/join",
  "/onboarding",
  "/profile",
]);

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://biso.no";

/**
 * BI OIDC link return leg.
 *
 * `NeedsBiLinkState`, `OnboardingFlow`, and `IdentityManagement` all point
 * Appwrite's `createOAuth2Session` success URL here (with `returnTo` set to
 * the page that started the flow) instead of directly back at that page with
 * `?linked=1`.
 *
 * This exists to fix a seam bug: `syncBiStudentIdentity` writes the profile
 * and calls `revalidateTag`, both of which must not run during a Server
 * Component render — `revalidateTag` throws unconditionally in that phase,
 * and even setting that aside, a page that both writes and reads back through
 * a request-memoized `getLoggedInUser()` in the same render pass would read
 * its own pre-write snapshot. Running the sync here, in a Route Handler, then
 * redirecting keeps both operations outside the render phase and starts a
 * genuinely new request for the destination page, so its reads see the write.
 *
 * The destination pages keep reading `?linked=1` off the query string for
 * their own UI purposes (e.g. `OnboardingFlow` skipping the "link BI" step) —
 * that convention is untouched. What changed is which side effect they run:
 * none. The sync already happened here, so a page refresh after landing is
 * inert instead of re-triggering the Graph call and the DB write.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedReturnTo = searchParams.get("returnTo") ?? "";
  const returnTo = ALLOWED_RETURN_PATHS.has(requestedReturnTo)
    ? requestedReturnTo
    : "/profile";

  await syncBiStudentIdentity();

  const destination = new URL(returnTo, SITE_URL);
  destination.searchParams.set("linked", "1");
  return NextResponse.redirect(destination);
}
