import { NextResponse } from "next/server";

/**
 * The bylaws used to be a page of static copy that told readers to ask the
 * Operations Unit for the current documents. The documents themselves are
 * published on /documents, so this address opens that shelf.
 *
 * A real 308 from a route handler, for the reason documented in
 * `(public)/varsling/route.ts`.
 */
export function GET(request: Request): NextResponse {
  return NextResponse.redirect(
    new URL("/documents?category=campus-bylaws", request.url),
    308
  );
}
