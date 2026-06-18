import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { applyCorsHeaders } from "./lib/cors";

export function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");

  // Check if the request is for an API route
  if (request.nextUrl.pathname.startsWith("/api")) {
    // Handle preflight requests
    if (request.method === "OPTIONS") {
      const response = new NextResponse(null, { status: 204 });
      response.headers.set("Access-Control-Max-Age", "86400");
      return applyCorsHeaders(response, origin);
    }

    // Handle actual requests
    return applyCorsHeaders(NextResponse.next(), origin);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
