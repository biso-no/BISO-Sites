import { NextResponse } from "next/server";

/**
 * Every membership CTA on the site points at /membership/join. The purchase
 * flow lives there; this keeps the old /shop/membership path working. The
 * static segment still wins over the (public)/shop/[slug] catch-all — Next.js
 * prefers a static route over a dynamic one at the same depth, and that holds
 * for route handlers as it did for the page.
 *
 * A route handler rather than a page calling `permanentRedirect()`, for the
 * reason documented in `(public)/varsling/route.ts`.
 */
export function GET(request: Request): NextResponse {
  return NextResponse.redirect(new URL("/membership/join", request.url), 308);
}
