import { type NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3003";

/**
 * Proxy route to forward summary generation requests to the API service.
 */
export async function POST(request: NextRequest) {
  try {
    // Forward cookies for auth
    const cookieHeader = request.headers.get("cookie") || "";

    // Get the JSON body from the request
    const body = await request.json();

    // Forward to API service
    const response = await fetch(`${API_BASE_URL}/api/expenses/summary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Summary proxy error:", error);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}
