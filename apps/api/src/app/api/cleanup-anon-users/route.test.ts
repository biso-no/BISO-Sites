import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, hasValidCronSecret } from "./route";

function cronRequest({
  authorization,
  querySecret,
  xCronSecret,
}: {
  authorization?: string;
  querySecret?: string;
  xCronSecret?: string;
} = {}): NextRequest {
  const headers = new Headers();
  if (authorization) {
    headers.set("authorization", authorization);
  }
  if (xCronSecret) {
    headers.set("x-cron-secret", xCronSecret);
  }

  const nextUrl = new URL("https://api.biso.no/api/cleanup-anon-users");
  if (querySecret) {
    nextUrl.searchParams.set("secret", querySecret);
  }

  return { headers, nextUrl } as unknown as NextRequest;
}

describe("anonymous user cleanup auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts bearer and cron secret headers", () => {
    expect(
      hasValidCronSecret(
        cronRequest({ authorization: "Bearer secret" }),
        "secret"
      )
    ).toBe(true);
    expect(
      hasValidCronSecret(cronRequest({ xCronSecret: "secret" }), "secret")
    ).toBe(true);
  });

  it("rejects query-string secrets", () => {
    expect(
      hasValidCronSecret(cronRequest({ querySecret: "secret" }), "secret")
    ).toBe(false);
  });

  it("rejects unauthorized requests before cleanup runs", async () => {
    vi.stubEnv("CRON_SECRET", "secret");

    const response = await GET(cronRequest({ authorization: "Bearer wrong" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      error: "Unauthorized",
    });
  });

  it("refuses to run when CRON_SECRET is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");

    const response = await GET(cronRequest());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "SECRET_NOT_CONFIGURED",
      error: "CRON_SECRET is not configured",
    });
  });
});
