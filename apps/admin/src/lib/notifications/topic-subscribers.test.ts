import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

// `topic-subscribers.ts` starts with `import "server-only"`. Next.js aliases
// that package away via the `react-server` export condition when bundling;
// plain `bun test` doesn't set that condition, so the marker package throws
// on import unless it's neutralized here (same pattern as
// `src/app/(portal)/_actions/approvals.test.ts` and
// `packages/api/page-builder.test.ts`).
mock.module("server-only", () => ({}));

/** Push subscriber totals per Appwrite topic id; a missing id has no total. */
let totals: Record<string, number> = {};

const listSubscribers = mock(async ({ topicId }: { topicId: string }) =>
  topicId in totals
    ? { subscribers: [], total: totals[topicId] }
    : { subscribers: [] }
);

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ messaging: { listSubscribers } })),
}));
// `unstable_cache` needs a Next.js request; run the wrapped function directly
// (same pattern as `src/app/(scan)/scan/actions.test.ts`).
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  unstable_cache:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      fn(...args),
}));

const { getEventTopicSubscriberCounts, pickPushSubscriberTotal } = await import(
  "./topic-subscribers"
);

describe("pickPushSubscriberTotal", () => {
  test("returns the total from a subscriber list", () => {
    expect(pickPushSubscriberTotal({ subscribers: [], total: 42 })).toBe(42);
  });

  test("returns zero when a topic genuinely has no subscribers", () => {
    expect(pickPushSubscriberTotal({ subscribers: [], total: 0 })).toBe(0);
  });

  test(
    "returns null when the total is missing rather than reporting zero - a " +
      "fabricated count is the bug this replaces",
    () => {
      expect(pickPushSubscriberTotal({ subscribers: [] })).toBeNull();
      expect(pickPushSubscriberTotal(undefined)).toBeNull();
    }
  );

  test("returns null for a non-numeric total", () => {
    expect(
      pickPushSubscriberTotal({ subscribers: [], total: "many" })
    ).toBeNull();
  });
});

describe("getEventTopicSubscriberCounts", () => {
  beforeEach(() => {
    totals = {};
    listSubscribers.mockClear();
  });

  test("adds up a campus's events subscribers across both languages", async () => {
    totals = { events_bergen_en: 4, events_bergen_no: 3 };

    await expect(getEventTopicSubscriberCounts(["2"])).resolves.toEqual({
      "2": 7,
    });
    expect(
      listSubscribers.mock.calls.map(([params]) => params.topicId).sort()
    ).toEqual(["events_bergen_en", "events_bergen_no"]);
  });

  test("is unknown when either language's count is unknown", async () => {
    totals = { events_oslo_no: 3 };

    await expect(getEventTopicSubscriberCounts(["1"])).resolves.toEqual({
      "1": null,
    });
  });

  test("is unknown when a language's lookup fails", async () => {
    const quiet = spyOn(console, "error").mockImplementation(() => undefined);
    totals = { events_oslo_en: 4, events_oslo_no: 3 };
    listSubscribers.mockImplementationOnce(() =>
      Promise.reject(new Error("boom"))
    );

    await expect(getEventTopicSubscriberCounts(["1"])).resolves.toEqual({
      "1": null,
    });
    quiet.mockRestore();
  });
});
