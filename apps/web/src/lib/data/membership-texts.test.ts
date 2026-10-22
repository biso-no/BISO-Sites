import { beforeEach, describe, expect, it, vi } from "vitest";

const publicDb = vi.hoisted(() => ({ listRows: vi.fn() }));
const cache = vi.hoisted(() => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createPublicClient: vi.fn(async () => ({ db: publicDb })),
}));
vi.mock("next/cache", () => cache);

import {
  cachedMembershipTextRows,
  getMembershipTextItems,
} from "./membership-texts";

describe("membership text readers", () => {
  beforeEach(() => {
    publicDb.listRows.mockReset();
    cache.cacheTag.mockReset();
    cache.cacheLife.mockReset();
  });

  it("reads the table once, tags membership-texts and sets a cache life", async () => {
    publicDb.listRows.mockResolvedValue({ rows: [] });
    await cachedMembershipTextRows();
    expect(publicDb.listRows).toHaveBeenCalledTimes(1);
    expect(publicDb.listRows.mock.calls[0][1]).toBe("membership_texts");
    expect(cache.cacheTag).toHaveBeenCalledWith("membership-texts");
    expect(cache.cacheLife).toHaveBeenCalledWith("minutes");
  });

  it("throws from the cached reader when the read fails", async () => {
    publicDb.listRows.mockRejectedValue(new Error("down"));
    await expect(cachedMembershipTextRows()).rejects.toThrow("down");
  });

  it("maps rows to the spot's items in the locale", async () => {
    publicDb.listRows.mockResolvedValue({
      rows: [
        { sort_order: 1, spot: "onboarding", title_en: "B", title_nb: "b" },
        { sort_order: 0, spot: "onboarding", title_en: "A", title_nb: "a" },
        { sort_order: 0, spot: "plan_card", title_en: "X", title_nb: "x" },
      ],
    });
    expect(await getMembershipTextItems("onboarding", "en")).toEqual([
      { body: null, title: "A" },
      { body: null, title: "B" },
    ]);
  });

  it("returns null for a spot without rows", async () => {
    publicDb.listRows.mockResolvedValue({ rows: [] });
    expect(await getMembershipTextItems("business", "no")).toBeNull();
  });

  it("returns null, logging no row contents, when the read throws", async () => {
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    publicDb.listRows.mockRejectedValue(new Error("secret row text"));
    expect(await getMembershipTextItems("business", "no")).toBeNull();
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret row text");
    error.mockRestore();
  });
});
