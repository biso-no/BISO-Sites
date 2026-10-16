import { NextResponse } from "next/server";
import { ABOUT_REDIRECTS } from "@/lib/about-sections";

/**
 * Folded into the merged Om BISO page; the old address lands on its section.
 *
 * A route handler rather than a page calling `redirect()`: under
 * `cacheComponents` a page flushes its shell with a 200 before the redirect
 * runs, so the hop degrades to a client-side one and crawlers never see the
 * move. See `(public)/varsling/route.ts` (RD-034).
 */
export function GET(request: Request): NextResponse {
  return NextResponse.redirect(
    new URL(ABOUT_REDIRECTS.alumni, request.url),
    308
  );
}
