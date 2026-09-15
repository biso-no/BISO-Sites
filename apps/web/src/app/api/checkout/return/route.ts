import { NextResponse } from "next/server";

const TRAILING_SLASHES_RE = /\/+$/;

/**
 * Legacy post-payment return target.
 *
 * Payment sessions created before the return route moved to the API app still
 * send buyers here. This forwards them, query intact, to the API route that
 * now reconciles and settles the order; it calls no third party itself.
 * Delete it one week after the API return route is live.
 */
export function GET(request: Request): NextResponse {
  const shopFallback = () =>
    NextResponse.redirect(
      new URL("/shop", process.env.NEXT_PUBLIC_BASE_URL || "https://biso.no")
    );

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase) {
    return shopFallback();
  }

  try {
    const search = new URL(request.url).search;
    const target = `${apiBase.replace(TRAILING_SLASHES_RE, "")}/api/payment/return${search}`;
    return NextResponse.redirect(target);
  } catch {
    // A malformed NEXT_PUBLIC_API_BASE_URL must not 500 a buyer who already
    // paid — fall back to the shop instead of throwing.
    return shopFallback();
  }
}
