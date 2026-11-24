import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

interface Target {
  providerType: string;
}
const usersGet = mock(
  async (_args: { userId: string }): Promise<{ targets: Target[] }> => ({
    targets: [],
  })
);
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ users: { get: usersGet } })),
}));

interface CacheOptions {
  revalidate?: number;
  tags?: string[];
}
const unstableCache = mock(
  (
    fn: (...args: unknown[]) => unknown,
    _keyParts?: string[],
    _options?: CacheOptions
  ) =>
    (...args: unknown[]) =>
      fn(...args)
);
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
  revalidateTag: mock(() => undefined),
  unstable_cache: unstableCache,
}));

const { getPushReach } = await import("./reach.server");

const targetsByUser: Record<string, Target[]> = {
  "u-email": [{ providerType: "email" }],
  "u-push": [{ providerType: "email" }, { providerType: "push" }],
};

beforeEach(() => {
  usersGet.mockReset();
  unstableCache.mockClear();
  usersGet.mockImplementation(async ({ userId }) => ({
    targets: targetsByUser[userId] ?? [],
  }));
});

describe("getPushReach", () => {
  test("counts only users with a push target", async () => {
    const reach = await getPushReach(["u-push", "u-email", "u-none"]);
    expect([...reach]).toEqual(["u-push"]);
  });

  test("a failed lookup counts as no push", async () => {
    usersGet.mockImplementation(({ userId }) =>
      userId === "u-push"
        ? Promise.reject(new Error("Appwrite is down"))
        : Promise.resolve({ targets: targetsByUser[userId] ?? [] })
    );
    const reach = await getPushReach(["u-push", "u-email"]);
    expect(reach.size).toBe(0);
  });

  test("asks once per account and caches each answer for five minutes", async () => {
    await getPushReach(["u-push", "u-push", "u-email"]);
    expect(usersGet).toHaveBeenCalledTimes(2);
    const options = unstableCache.mock.calls.map((call) => call[2]);
    expect(options).toEqual([
      { revalidate: 300, tags: ["big-event-reach"] },
      { revalidate: 300, tags: ["big-event-reach"] },
    ]);
  });

  test("keeps at most eight lookups in flight", async () => {
    let active = 0;
    let peak = 0;
    usersGet.mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return { targets: [] };
    });
    const ids = Array.from({ length: 20 }, (_, index) => `u${index}`);
    await getPushReach(ids);
    expect(peak).toBe(8);
  });
});
