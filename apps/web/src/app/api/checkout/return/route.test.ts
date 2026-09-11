import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("legacy checkout return", () => {
  it("forwards the buyer to the API return route with the same query", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no");

    const response = GET(
      new Request(
        "https://biso.no/api/checkout/return?orderId=order-1&client=app"
      )
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://api.biso.no/api/payment/return?orderId=order-1&client=app"
    );
  });

  it("falls back to the shop when the API origin is not configured", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://biso.no");

    const response = GET(
      new Request("https://biso.no/api/checkout/return?orderId=order-1")
    );

    expect(response.headers.get("location")).toBe("https://biso.no/shop");
  });

  it("still forwards correctly when the API base URL has a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no/");

    const response = GET(
      new Request(
        "https://biso.no/api/checkout/return?orderId=order-1&client=app"
      )
    );

    expect(response.headers.get("location")).toBe(
      "https://api.biso.no/api/payment/return?orderId=order-1&client=app"
    );
  });

  it("falls back to the shop when the API base URL is malformed", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "not a url");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://biso.no");

    const response = GET(
      new Request("https://biso.no/api/checkout/return?orderId=order-1")
    );

    expect(response.headers.get("location")).toBe("https://biso.no/shop");
  });
});
