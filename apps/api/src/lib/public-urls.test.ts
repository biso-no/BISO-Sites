import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBaseUrl, webBaseUrl } from "./public-urls";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("webBaseUrl", () => {
  it("prefers the web-specific origin and strips trailing slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "https://biso.no/");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://api.biso.no");
    expect(webBaseUrl()).toBe("https://biso.no");
  });

  it("falls back to the shared origin", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://biso.no");
    expect(webBaseUrl()).toBe("https://biso.no");
  });

  it("is undefined when neither is set", () => {
    vi.stubEnv("NEXT_PUBLIC_WEB_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
    expect(webBaseUrl()).toBeUndefined();
  });
});

describe("apiBaseUrl", () => {
  it("returns the API origin without trailing slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.biso.no//");
    expect(apiBaseUrl()).toBe("https://api.biso.no");
  });

  it("is undefined when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "");
    expect(apiBaseUrl()).toBeUndefined();
  });
});
