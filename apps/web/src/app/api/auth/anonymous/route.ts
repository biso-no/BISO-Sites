import { createAdminClient } from "@repo/api/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { account } = await createAdminClient();
    const session = await account.createAnonymousSession();
    
    console.log("Anonymous user created:", session.userId);
    
    const cookieStore = await cookies();
    cookieStore.set("a_session_biso", session.secret, {
    path: "/",
    httpOnly: true,
    sameSite: "none",
    secure: true,
    domain: ".biso.no"
    });
    
    // Get the redirect URL from query params
    const redirectUrl = request.nextUrl.searchParams.get('redirect') || '/';
    
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  } catch (error) {
    console.error("Error creating anonymous session:", error);
    // Redirect to home page even if anonymous session creation fails
    const redirectUrl = request.nextUrl.searchParams.get('redirect') || '/';
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }
}

// Also support POST for programmatic calls
export async function POST(request: NextRequest) {
  try {
    const { account } = await createAdminClient();
    const session = await account.createAnonymousSession();
    
    console.log("Anonymous user created:", session.userId);
    
    const cookieStore = await cookies();
    cookieStore.set("a_session_biso", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    
    return NextResponse.json({ 
      success: true, 
      userId: session.userId 
    });
  } catch (error) {
    console.error("Error creating anonymous session:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create anonymous session" },
      { status: 500 }
    );
  }
}
