import { NextResponse } from "next/server";

/**
 * The drug and alcohol policy moved under Om BISO. The old address keeps
 * working with a real 308 — a route handler, for the reason documented in
 * `(public)/varsling/route.ts`.
 */
export function GET(request: Request): NextResponse {
  return NextResponse.redirect(
    new URL("/about/drugs-policy", request.url),
    308
  );
}
