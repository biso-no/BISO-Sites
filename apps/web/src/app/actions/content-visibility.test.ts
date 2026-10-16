import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionDb = vi.hoisted(() => ({ listRows: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createSessionClient: vi.fn(async () => ({ db: sessionDb })),
}));

import { getCollectionEvents, listEvents } from "./events";
import { listNews } from "./news";

/**
 * Drafts stay private on the public site.
 *
 * `events` and `news` grant `read("any")`, so the status filter in the query
 * is the only thing keeping a draft, pending or cancelled row off the page.
 * These readers are server actions — ordinary POST endpoints whose arguments
 * are whatever the browser sends — so the filter must not be reachable through
 * an argument. `status: "all"` once dropped it on both feeds, and a bare
 * `listNews()` never applied it. Same rule as `listProducts`
 * (`webshop-visibility.test.ts`).
 */
const queriesOf = (call: number): string =>
  sessionDb.listRows.mock.calls[call][2].map(String).join("|");

const PUBLISHED_FILTER =
  '"method":"equal","attribute":"status","values":["published"]';
const ANY_STATUS_FILTER = /"attribute":"status","values":\["(?!published)/;

// What a hostile caller can send; the declared types no longer allow it.
const HOSTILE = [
  { status: "all" },
  { status: "draft" },
  { status: "cancelled" },
] as unknown as Parameters<typeof listEvents>[0][];

beforeEach(() => {
  sessionDb.listRows.mockReset();
  sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
});

describe("the public event feed", () => {
  it("lists only published events by default", async () => {
    await listEvents();
    expect(queriesOf(0)).toContain(PUBLISHED_FILTER);
  });

  it.each(
    HOSTILE
  )("cannot be talked out of the filter by %o", async (params) => {
    await listEvents(params);
    expect(queriesOf(0)).toContain(PUBLISHED_FILTER);
    expect(queriesOf(0)).not.toMatch(ANY_STATUS_FILTER);
  });

  it("lists only the published sessions of a collection", async () => {
    // A draft session linked to a 404 from the published collection's page.
    await getCollectionEvents("collection-1", "no");
    expect(queriesOf(0)).toContain(PUBLISHED_FILTER);
  });
});

describe("the public news feed", () => {
  it("lists only published articles when called bare", async () => {
    await listNews();
    expect(queriesOf(0)).toContain(PUBLISHED_FILTER);
  });

  it.each(
    HOSTILE
  )("cannot be talked out of the filter by %o", async (params) => {
    await listNews(params as Parameters<typeof listNews>[0]);
    expect(queriesOf(0)).toContain(PUBLISHED_FILTER);
    expect(queriesOf(0)).not.toMatch(ANY_STATUS_FILTER);
  });
});
