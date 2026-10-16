import { describe, expect, mock, test } from "bun:test";

// `topic-subscribers.ts` starts with `import "server-only"`. Next.js aliases
// that package away via the `react-server` export condition when bundling;
// plain `bun test` doesn't set that condition, so the marker package throws
// on import unless it's neutralized here (same pattern as
// `src/app/(portal)/_actions/approvals.test.ts` and
// `packages/api/page-builder.test.ts`).
mock.module("server-only", () => ({}));

const { pickPushSubscriberTotal } = await import("./topic-subscribers");

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
