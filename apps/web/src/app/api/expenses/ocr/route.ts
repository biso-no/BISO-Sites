import { type NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3003";

/**
 * Proxy route to forward OCR requests to the API service.
 * This keeps the client simple and handles auth in one place.
 */
export async function POST(request: NextRequest) {
  try {
    // Forward cookies for auth
    const cookieHeader = request.headers.get("cookie") || "";

    // Get the form data from the request
    const formData = await request.formData();

    // Forward to API service
    const response = await fetch(`${API_BASE_URL}/api/expenses/ocr`, {
      method: "POST",
      headers: {
        cookie: cookieHeader,
      },
      body: formData,
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("OCR proxy error:", error);
    return NextResponse.json(
      { error: "Failed to process document" },
      { status: 500 }
    );
  }
}
