import { beforeEach, describe, expect, it, vi } from "vitest";

const publicDb = vi.hoisted(() => ({ listRows: vi.fn() }));
const cache = vi.hoisted(() => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

vi.mock("@repo/api/server", () => ({
  createPublicClient: vi.fn(async () => ({ db: publicDb })),
}));
vi.mock("next/cache", () => cache);

import {
  cachedBenefitRows,
  cachedCampusLogos,
  getPublicBenefits,
} from "./benefits";

const queriesOf = (call: number): string =>
  publicDb.listRows.mock.calls[call][2].map(String).join("|");

describe("benefit readers", () => {
  beforeEach(() => {
    publicDb.listRows.mockReset();
    cache.cacheTag.mockReset();
  });

  it("reads published rows without redemption_value and tags benefits", async () => {
    publicDb.listRows.mockResolvedValue({ rows: [] });
    await cachedBenefitRows();
    const q = queriesOf(0);
    expect(q).toContain('"attribute":"status"');
    expect(q).toContain("published");
    expect(q).not.toContain("redemption_value");
    expect(q).toContain("$createdAt");
    expect(cache.cacheTag).toHaveBeenCalledWith("benefits");
  });

  it("drops a benefit whose partner is inactive", async () => {
    const row = (id: string, partner: string) => ({
      $createdAt: "2026-01-01T00:00:00.000Z",
      $id: id,
      campus_id: "1",
      partner_id: partner,
      redemption_type: "none",
      section: "discounts",
      status: "published",
      title_en: id,
      title_nb: id,
    });
    publicDb.listRows
      .mockResolvedValueOnce({ rows: [row("a", "p1"), row("b", "p2")] })
      .mockResolvedValueOnce({
        rows: [
          { $id: "p1", is_active: true, name: "One" },
          { $id: "p2", is_active: false, name: "Two" },
        ],
      });
    const result = await getPublicBenefits();
    expect(result.map((b) => b.id)).toEqual(["a"]);
  });

  it("maps campus logos ordered by campus then sort_order and tags partners", async () => {
    publicDb.listRows.mockResolvedValue({
      rows: [
        {
          $id: "x",
          campus_id: "2",
          image_url: "https://img",
          level: "campus",
          name: "Logo",
          url: null,
        },
      ],
    });
    await expect(cachedCampusLogos()).resolves.toEqual([
      {
        campusId: "2",
        id: "x",
        imageUrl: "https://img",
        name: "Logo",
        url: null,
      },
    ]);
    const q = queriesOf(0);
    expect(q.indexOf("campus_id")).toBeLessThan(q.indexOf("sort_order"));
    expect(cache.cacheTag).toHaveBeenCalledWith("partners");
  });

  it("rejects instead of returning an empty list when the db fails", async () => {
    publicDb.listRows.mockRejectedValue(new Error("down"));
    await expect(cachedBenefitRows()).rejects.toThrow("down");
    await expect(cachedCampusLogos()).rejects.toThrow("down");
    await expect(getPublicBenefits()).rejects.toThrow("down");
  });
});
