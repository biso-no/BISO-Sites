import { NextResponse } from "next/server";

/**
 * Legacy post-payment return target.
 *
 * Payment sessions created before the return route moved to the API app still
 * send buyers here. This forwards them, query intact, to the API route that
 * now reconciles and settles the order; it calls no third party itself.
 * Delete it one week after the API return route is live.
 */
export function GET(request: Request): NextResponse {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase) {
    return NextResponse.redirect(
      new URL("/shop", process.env.NEXT_PUBLIC_BASE_URL || "https://biso.no")
    );
  }
  const target = new URL("/api/payment/return", apiBase);
  target.search = new URL(request.url).search;
  return NextResponse.redirect(target);
}
