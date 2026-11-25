import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { pushTargetUsers } = await import("./push-targets");

interface Target {
  providerType: string;
}

const targetsByUser: Record<string, Target[]> = {
  "u-email": [{ providerType: "email" }],
  "u-push": [{ providerType: "email" }, { providerType: "push" }],
};

const get = vi.fn(
  async ({ userId }: { userId: string }): Promise<{ targets: Target[] }> => ({
    targets: targetsByUser[userId] ?? [],
  })
);
const users = { get };

beforeEach(() => {
  get.mockClear();
});

describe("pushTargetUsers", () => {
  it("counts only users with a push target", async () => {
    const reach = await pushTargetUsers(users, ["u-push", "u-email", "u-none"]);
    expect([...reach]).toEqual(["u-push"]);
  });

  it("a failed lookup counts as no push", async () => {
    get.mockImplementationOnce(() =>
      Promise.reject(new Error("Appwrite is down"))
    );
    const reach = await pushTargetUsers(users, ["u-push", "u-email"]);
    expect(reach.size).toBe(0);
  });

  it("asks once per account", async () => {
    await pushTargetUsers(users, ["u-push", "u-push", "u-email"]);
    expect(get.mock.calls.map(([args]) => args.userId)).toEqual([
      "u-push",
      "u-email",
    ]);
  });

  it("keeps at most eight lookups in flight", async () => {
    let active = 0;
    let peak = 0;
    get.mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return { targets: [] };
    });
    const ids = Array.from({ length: 20 }, (_, index) => `u${index}`);
    await pushTargetUsers(users, ids);
    expect(peak).toBe(8);
  });
});
