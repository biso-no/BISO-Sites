import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { applyCorsHeaders, corsPreflightResponse } from "./cors";

const allowedHeaders = (response: NextResponse) =>
  (response.headers.get("Access-Control-Allow-Headers") ?? "")
    .split(",")
    .map((header) => header.trim().toLowerCase());

describe("CORS headers", () => {
  // A browser SDK that adds trace headers to a cross-origin call must not
  // fail the preflight (expense OCR, summary and submit from biso.no).
  it("allows the Sentry trace headers in the preflight", () => {
    const headers = allowedHeaders(corsPreflightResponse("https://biso.no"));
    expect(headers).toContain("sentry-trace");
    expect(headers).toContain("baggage");
  });

  it("keeps the existing request headers", () => {
    const headers = allowedHeaders(
      applyCorsHeaders(NextResponse.next(), "https://biso.no")
    );
    expect(headers).toEqual(
      expect.arrayContaining([
        "content-type",
        "authorization",
        "cookie",
        "x-requested-with",
      ])
    );
  });
});
