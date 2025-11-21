import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  const existingCookie = req.cookies.get("a_session_biso");
  if (!existingCookie) {
    const anonymousUrl = new URL("/api/auth/anonymous", req.url);
    anonymousUrl.searchParams.set("redirect", pathname + req.nextUrl.search);
    return NextResponse.redirect(anonymousUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
