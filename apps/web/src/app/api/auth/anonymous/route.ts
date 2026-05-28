import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { safeRedirectPath } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const redirectPath = safeRedirectPath(
    request.nextUrl.searchParams.get("redirect")
  );

  try {
    const { account } = await createAdminClient();
    const session = await account.createAnonymousSession();

    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";
    cookieStore.set("a_session_biso", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      ...(isProduction && { domain: ".biso.no" }),
    });

    return NextResponse.redirect(new URL(redirectPath, request.url));
  } catch (error) {
    console.error("Error creating anonymous session:", error);
    return NextResponse.redirect(new URL(redirectPath, request.url));
  }
}

// Also support POST for programmatic calls
export async function POST(_request: NextRequest) {
  try {
    const { account } = await createAdminClient();
    const session = await account.createAnonymousSession();

    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";
    cookieStore.set("a_session_biso", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 60 * 60 * 24 * 30, // 30 days
      ...(isProduction && { domain: ".biso.no" }),
    });

    return NextResponse.json({
      success: true,
      userId: session.userId,
    });
  } catch (error) {
    console.error("Error creating anonymous session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create anonymous session" },
      { status: 500 }
    );
  }
}
