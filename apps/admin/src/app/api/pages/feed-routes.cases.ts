import { beforeEach, describe, expect, mock, test } from "bun:test";
import { feedLimitFromParam } from "@repo/editor/page-feeds";
import { NextResponse } from "next/server";

// Runs in its own `bun test` process (see route-cases.test.ts): the module
// mocks below are process-wide.

const readers = {
  events: mock((..._args: unknown[]) => Promise.resolve([{ id: "event" }])),
  jobs: mock((..._args: unknown[]) => Promise.resolve([{ id: "job" }])),
  news: mock((..._args: unknown[]) => Promise.resolve([{ id: "news" }])),
};
const ROW_IDS = { events: "event", jobs: "job", news: "news" } as const;
let authorized = true;

const actual = await import("@repo/shared/utils/page-feeds");
mock.module("@repo/shared/utils/page-feeds", () => ({
  ...actual,
  readPageEventsFeed: readers.events,
  readPageJobsFeed: readers.jobs,
  readPageNewsFeed: readers.news,
}));
mock.module("@/lib/api-auth", () => ({
  requireApiAuth: () =>
    Promise.resolve(
      authorized
        ? { ctx: {} }
        : { response: NextResponse.json({}, { status: 401 }) }
    ),
}));
const db = { marker: "public-db" };
mock.module("@repo/api/server", () => ({
  createPublicClient: () => Promise.resolve({ db }),
}));

const routes = {
  events: (await import("./events/route")).GET,
  jobs: (await import("./jobs/route")).GET,
  news: (await import("./news/route")).GET,
};

beforeEach(() => {
  authorized = true;
  for (const reader of Object.values(readers)) {
    reader.mockClear();
  }
});

for (const name of ["events", "jobs", "news"] as const) {
  const reader = readers[name];
  const call = (qs: string) =>
    routes[name](new Request(`http://admin.test/api/pages/${name}${qs}`));

  describe(`/api/pages/${name}`, () => {
    test("requires editor auth", async () => {
      authorized = false;
      expect((await call("?dept=25")).status).toBe(401);
      expect(reader).not.toHaveBeenCalled();
    });

    test("reads the department's feed from the public client, uncached", async () => {
      const response = await call("?dept=25&locale=en&limit=999");
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual([{ id: ROW_IDS[name] }]);
      expect(reader.mock.calls).toEqual([
        [db, "25", "en", feedLimitFromParam("999")],
      ]);
    });

    test("defaults to Norwegian and the default limit", async () => {
      await call("?dept=25");
      expect(reader.mock.calls).toEqual([
        [db, "25", "no", feedLimitFromParam(null)],
      ]);
    });

    test("answers an empty array without a valid department", async () => {
      expect(await (await call("")).json()).toEqual([]);
      expect(await (await call("?dept=a%20b")).json()).toEqual([]);
      expect(reader).not.toHaveBeenCalled();
    });

    test("answers an empty array when the read fails", async () => {
      reader.mockImplementationOnce(() => Promise.reject(new Error("down")));
      const response = await call("?dept=25");
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    });
  });
}
