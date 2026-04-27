import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://admin.biso.no",
  "https://web.biso.no",
  "https://public.biso.no",
  "https://biso.no",
]);

export function applyCorsHeaders(
  response: NextResponse,
  origin: string | null
) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
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
