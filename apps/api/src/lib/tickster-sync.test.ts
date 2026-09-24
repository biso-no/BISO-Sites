import type { TablesDB } from "@repo/api";
import type {
  TicksterClient,
  TicksterCrmPage,
  TicksterPurchase,
} from "@repo/connectors/tickster";
import { describe, expect, it, vi } from "vitest";
import {
  syncTicksterPurchases,
  type TicksterSyncConfig,
} from "./tickster-sync";

vi.mock("server-only", () => ({}));

const config: TicksterSyncConfig = {
  apiKey: "key",
  eogCode: "eog",
  eventMap: [{ ticksterEventId: "t1", eventId: "event-1", campusId: "1" }],
};

function purchase(reference: string): TicksterPurchase {
  return {
    email: null,
    eventId: "t1",
    name: "Ada",
    phone: null,
    purchasedAt: null,
    reference,
    ticketType: null,
  };
}

function clientWith(pages: Record<string, TicksterCrmPage>): TicksterClient {
  return {
    getCrmPurchases: vi.fn(
      async (cursor = "") =>
        pages[cursor] ?? { nextCursor: null, purchases: [] }
    ),
  } as unknown as TicksterClient;
}

function dbFailingOn(failingRefs: Set<string>) {
  let pendingRef = "";
  const db = {
    createRow: vi.fn(() =>
      failingRefs.has(pendingRef)
        ? Promise.reject(new Error(`upsert failed for ${pendingRef}`))
        : Promise.resolve({})
    ),
    listRows: vi.fn(({ queries }: { queries: string[] }) => {
      const refQuery = queries.find((query) => query.includes("order_ref"));
      pendingRef = refQuery ? (JSON.parse(refQuery).values[0] as string) : "";
      return Promise.resolve({ rows: [] });
    }),
    updateRow: vi.fn(),
  };
  return db as unknown as TablesDB & typeof db;
}

describe("syncTicksterPurchases", () => {
  it("advances the cursor across fully imported pages", async () => {
    const client = clientWith({
      "": { nextCursor: "c1", purchases: [purchase("r1")] },
      c1: { nextCursor: "c2", purchases: [purchase("r2")] },
    });

    const result = await syncTicksterPurchases({
      client,
      config,
      db: dbFailingOn(new Set()),
    });

    expect(result).toMatchObject({ failed: 0, imported: 2, lastCursor: "c2" });
  });

  it("counts failed upserts, keeps importing later pages and reports the first failing cursor", async () => {
    const client = clientWith({
      "": { nextCursor: "c1", purchases: [purchase("r1")] },
      c1: { nextCursor: "c2", purchases: [purchase("r2"), purchase("r3")] },
      c2: { nextCursor: "c3", purchases: [purchase("r4")] },
    });

    const result = await syncTicksterPurchases({
      client,
      config,
      db: dbFailingOn(new Set(["r2"])),
    });

    // Page c1 had a failure: later pages are still imported (one poison
    // purchase must not block new buyers), and lastCursor points at c1 so a
    // `?from=` rerun retries r2.
    expect(result).toMatchObject({ failed: 1, imported: 3, lastCursor: "c1" });
    expect(client.getCrmPurchases).toHaveBeenCalledWith("c2");
  });

  it("keeps the starting cursor when the first page fails", async () => {
    const client = clientWith({
      start: { nextCursor: "c1", purchases: [purchase("r1")] },
    });

    const result = await syncTicksterPurchases({
      client,
      config,
      db: dbFailingOn(new Set(["r1"])),
      fromPurchase: "start",
    });

    expect(result).toMatchObject({ failed: 1, lastCursor: "start" });
  });
});
