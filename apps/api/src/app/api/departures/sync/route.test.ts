import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const syncDepartures = vi.hoisted(() => vi.fn());

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: {} })),
}));

vi.mock("@/lib/entur-departures", () => ({
  getDepartureSyncSecret: () => "secret",
  syncDepartures,
}));

import { GET, hasValidSyncSecret } from "./route";

function syncRequest({
  authorization,
  querySecret,
  xCronSecret,
  xSyncSecret,
}: {
  authorization?: string;
  querySecret?: string;
  xCronSecret?: string;
  xSyncSecret?: string;
} = {}): NextRequest {
  const headers = new Headers();
  if (authorization) {
    headers.set("authorization", authorization);
  }
  if (xCronSecret) {
    headers.set("x-cron-secret", xCronSecret);
  }
  if (xSyncSecret) {
    headers.set("x-sync-secret", xSyncSecret);
  }

  const nextUrl = new URL("https://api.biso.no/api/departures/sync");
  if (querySecret) {
    nextUrl.searchParams.set("secret", querySecret);
  }

  return { headers, nextUrl } as unknown as NextRequest;
}

describe("departures sync secret auth", () => {
  it("accepts a bearer token", () => {
    expect(
      hasValidSyncSecret(
        syncRequest({ authorization: "Bearer secret" }),
        "secret"
      )
    ).toBe(true);
  });

  it("accepts cron and sync secret headers", () => {
    expect(
      hasValidSyncSecret(syncRequest({ xCronSecret: "secret" }), "secret")
    ).toBe(true);
    expect(
      hasValidSyncSecret(syncRequest({ xSyncSecret: "secret" }), "secret")
    ).toBe(true);
  });

  it("rejects query-string secrets", () => {
    expect(
      hasValidSyncSecret(syncRequest({ querySecret: "secret" }), "secret")
    ).toBe(false);
  });

  it("rejects missing or incorrect secrets", () => {
    expect(hasValidSyncSecret(syncRequest(), "secret")).toBe(false);
    expect(
      hasValidSyncSecret(
        syncRequest({ authorization: "Bearer wrong" }),
        "secret"
      )
    ).toBe(false);
  });

  it("returns 502 with ok:false when any stop failed", async () => {
    syncDepartures.mockResolvedValueOnce({
      failed: [{ id: "NSR:1", reason: "boom" }],
      skipped: [],
      updated: ["NSR:2"],
    });

    const response = await GET(syncRequest({ authorization: "Bearer secret" }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });

  it("returns 200 with ok:true when nothing failed", async () => {
    syncDepartures.mockResolvedValueOnce({
      failed: [],
      skipped: [],
      updated: ["NSR:2"],
    });

    const response = await GET(syncRequest({ authorization: "Bearer secret" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });
});
