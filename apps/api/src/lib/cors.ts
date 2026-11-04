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
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cookie, X-Requested-With"
  );

  return response;
}

export function corsPreflightResponse(origin: string | null) {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Max-Age", "86400");
  return applyCorsHeaders(response, origin);
}

/**
 * A JSON answer with the CORS headers, which no cache may keep: these
 * responses are about the signed-in caller.
 */
export function noStoreJson(
  body: unknown,
  origin: string | null,
  status = 200
) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return applyCorsHeaders(response, origin);
}
