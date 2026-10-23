import { NextResponse } from "next/server";

/**
 * Legacy URL alias — 308 permanent redirect to the canonical /safety page.
 * External links and the old footer pointed at /varsling; this preserves them.
 *
 * This is a route handler, not a page calling `permanentRedirect()`. With
 * `cacheComponents` + `partialPrefetching` enabled in `next.config.ts`, Next
 * flushes the prerendered shell with a 200 *before* the dynamic part runs, so a
 * `permanentRedirect()` reached inside a page body can no longer set the HTTP
 * status — it degrades to a client-side redirect after hydration. Crawlers that
 * do not execute JS then see a 200 with shell content and no link equity passes
 * to the target, which defeats the entire point of the alias. A route handler
 * runs before the render pipeline and returns a real 308.
 *
 * Verified in RD-034: `curl -sI /varsling` must report `HTTP/1.1 308`.
 */
export function GET(request: Request): NextResponse {
  return NextResponse.redirect(new URL("/safety", request.url), 308);
}
