import { NextRequest, NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const authStatus = await getAuthStatus();
    
    return NextResponse.json(authStatus, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("Error checking authentication status:", error);
    
    return NextResponse.json(
      { 
        hasSession: false, 
        isAuthenticated: false, 
        isAnonymous: false,
        error: "Failed to check authentication status" 
      },
      { status: 500 }
    );
  }
}
