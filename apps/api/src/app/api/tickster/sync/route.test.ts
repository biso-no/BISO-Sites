import type { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const syncTicksterPurchases = vi.hoisted(() => vi.fn());

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: {}, users: {} })),
}));

vi.mock("@/lib/tickster-sync", () => ({
  getTicksterSyncConfig: () => ({ apiKey: "k", eogCode: "e", eventMap: [] }),
  getTicksterSyncSecret: () => "secret",
  syncTicksterPurchases,
}));

import { GET } from "./route";

function authedRequest(): NextRequest {
  return {
    headers: new Headers({ authorization: "Bearer secret" }),
    nextUrl: new URL("https://api.biso.no/api/tickster/sync"),
  } as unknown as NextRequest;
}

const baseResult = {
  imported: 1,
  lastCursor: "c1",
  matched: 0,
  pages: 1,
  skipped: 0,
};

describe("tickster sync route", () => {
  it("returns 502 with ok:false when any purchase failed to import", async () => {
    syncTicksterPurchases.mockResolvedValueOnce({ ...baseResult, failed: 2 });

    const response = await GET(authedRequest());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      failed: 2,
      ok: false,
    });
  });

  it("returns 200 with ok:true when every purchase imported", async () => {
    syncTicksterPurchases.mockResolvedValueOnce({ ...baseResult, failed: 0 });

    const response = await GET(authedRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
  });
});
