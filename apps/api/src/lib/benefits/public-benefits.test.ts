import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listRows = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { listRows } })),
}));

import {
  clearPublicBenefitsCache,
  getPublicBenefitsForCampus,
} from "./public-benefits";

const T0 = new Date("2026-10-22T12:00:00.000Z");
const SECOND = 1000;

function row(id: string, extra: Record<string, unknown> = {}) {
  return {
    $createdAt: "2026-01-01T00:00:00.000Z",
    $id: id,
    campus_id: "5",
    redemption_type: "code",
    section: "member",
    sort_order: 0,
    status: "published",
    title_nb: `Fordel ${id}`,
    ...extra,
  };
}

function benefitReads(): number {
  return listRows.mock.calls.filter((call) => call[1] === "campus_benefits")
    .length;
}

function ids(benefits: { id: string }[]): string[] {
  return benefits.map((b) => b.id).sort();
}

describe("getPublicBenefitsForCampus cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPublicBenefitsCache();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
    listRows.mockImplementation((_db: string, table: string) =>
      Promise.resolve({
        rows: table === "campus_benefits" ? [row("a"), row("b")] : [],
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the database once for requests within the TTL", async () => {
    await getPublicBenefitsForCampus("2", new Date());
    vi.setSystemTime(T0.getTime() + 30 * SECOND);
    const second = await getPublicBenefitsForCampus(null, new Date());

    expect(benefitReads()).toBe(1);
    expect(listRows).toHaveBeenCalledTimes(2); // benefits + partners, once
    expect(ids(second)).toEqual(["a", "b"]);
  });

  it("reads again once the TTL has passed", async () => {
    await getPublicBenefitsForCampus("2", new Date());
    vi.setSystemTime(T0.getTime() + 46 * SECOND);
    await getPublicBenefitsForCampus("2", new Date());

    expect(benefitReads()).toBe(2);
  });

  it("applies visibility with each request's clock, even from the cache", async () => {
    listRows.mockImplementation((_db: string, table: string) =>
      Promise.resolve({
        rows:
          table === "campus_benefits"
            ? [
                row("stays"),
                row("ends-soon", {
                  publish_end: new Date(
                    T0.getTime() + 10 * SECOND
                  ).toISOString(),
                }),
              ]
            : [],
      })
    );

    const before = await getPublicBenefitsForCampus(null, T0);
    const after = await getPublicBenefitsForCampus(
      null,
      new Date(T0.getTime() + 20 * SECOND)
    );

    expect(benefitReads()).toBe(1);
    expect(ids(before)).toEqual(["ends-soon", "stays"]);
    expect(ids(after)).toEqual(["stays"]);
  });

  it("never caches a failed read", async () => {
    listRows.mockRejectedValueOnce(new Error("boom"));

    await expect(getPublicBenefitsForCampus(null, new Date())).rejects.toThrow(
      "boom"
    );
    const benefits = await getPublicBenefitsForCampus(null, new Date());

    expect(ids(benefits)).toEqual(["a", "b"]);
    expect(benefitReads()).toBe(2);
  });
});
