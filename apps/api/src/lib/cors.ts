import { NextResponse } from "next/server";
import { isAllowedOrigin } from "./allowed-origins";

export function applyCorsHeaders(
  response: NextResponse,
  origin: string | null
) {
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Vary", "Origin");
  }

  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  // `sentry-trace` and `baggage`: should a browser SDK ever add trace headers
  // to a call here, the preflight still passes.
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie, X-Requested-With, sentry-trace, baggage"
  );

  return response;
}

export function corsPreflightResponse(origin: string | null) {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Max-Age", "86400");
  return applyCorsHeaders(response, origin);
}
