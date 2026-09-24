import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const users = vi.hoisted(() => ({
  delete: vi.fn(),
  list: vi.fn(),
}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ users })),
}));

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

  it("returns 500 with ok:false when some deletes fail", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    users.list.mockReset();
    users.delete.mockReset();
    users.list.mockResolvedValueOnce({
      users: [{ $id: "anon-1" }, { $id: "anon-2" }],
    });
    users.delete
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("boom"));

    const response = await GET(cronRequest({ authorization: "Bearer secret" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      deletedCount: 1,
      failedCount: 1,
      ok: false,
    });
  });

  it("returns 500 JSON when listing users throws", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    users.list.mockReset();
    users.list.mockRejectedValueOnce(new Error("appwrite down"));

    const response = await GET(cronRequest({ authorization: "Bearer secret" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      code: "INTERNAL_ERROR",
      ok: false,
    });
  });

  it("returns 200 when every delete succeeds", async () => {
    vi.stubEnv("CRON_SECRET", "secret");
    users.list.mockReset();
    users.delete.mockReset();
    users.list
      .mockResolvedValueOnce({ users: [{ $id: "anon-1" }] })
      .mockResolvedValueOnce({ users: [] });
    users.delete.mockResolvedValue({});

    const response = await GET(cronRequest({ authorization: "Bearer secret" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deletedCount: 1,
      failedCount: 0,
      ok: true,
    });
  });
});
