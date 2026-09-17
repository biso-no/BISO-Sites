import { beforeEach, describe, expect, it, vi } from "vitest";

const getCustomerCategories = vi.hoisted(() => vi.fn());
const listRows = vi.hoisted(() => vi.fn());

vi.mock("@repo/connectors/24sevenoffice", () => ({ getCustomerCategories }));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { listRows } })),
}));
vi.mock("@repo/api/client", () => ({
  Query: {
    equal: (key: string, value: unknown) => `equal(${key},${String(value)})`,
    limit: (count: number) => `limit(${count})`,
  },
}));

import {
  computeMembershipStatus,
  isMembershipRowActive,
  osloToday,
  pickCurrentMembership,
} from "./membership-status";

function row(id: string, category: string, expiryDate: string) {
  return {
    $id: id,
    category,
    expiryDate,
    name: `BISO Membership ${id}`,
    startDate: "2026-01-01",
  };
}

describe("isMembershipRowActive", () => {
  it("keeps a membership valid through the whole of its expiry day in Oslo", () => {
    // 23:30 in Oslo (UTC+2 in summer) on the expiry day.
    expect(
      isMembershipRowActive("2026-06-30", new Date("2026-06-30T21:30:00Z"))
    ).toBe(true);
    // 00:30 in Oslo the next day, while it is still 30 June in UTC.
    expect(
      isMembershipRowActive("2026-06-30", new Date("2026-06-30T22:30:00Z"))
    ).toBe(false);
  });

  it("reads a date-time expiry by its date part", () => {
    expect(
      isMembershipRowActive(
        "2026-12-31T00:00:00.000+00:00",
        new Date("2026-12-31T12:00:00Z")
      )
    ).toBe(true);
  });

  it("reads a DD.MM.YYYY expiry", () => {
    expect(
      isMembershipRowActive("31.12.2026", new Date("2026-09-17T10:00:00Z"))
    ).toBe(true);
    expect(
      isMembershipRowActive("30.06.2026", new Date("2026-09-17T10:00:00Z"))
    ).toBe(false);
  });

  it("treats an unreadable expiry as expired", () => {
    expect(isMembershipRowActive("", new Date())).toBe(false);
    expect(isMembershipRowActive("fall 2026", new Date())).toBe(false);
    expect(isMembershipRowActive(null, new Date())).toBe(false);
  });

  it("formats today's Oslo date as YYYY-MM-DD", () => {
    expect(osloToday(new Date("2026-01-01T23:30:00Z"))).toBe("2026-01-02");
  });
});

describe("computeMembershipStatus", () => {
  const now = new Date("2026-09-15T10:00:00Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("counts only unexpired rows whose category the customer holds", async () => {
    getCustomerCategories.mockResolvedValue([113_176, 113_178, 999]);
    listRows.mockResolvedValue({
      rows: [
        row("spring-2026", "113176", "2026-06-30"),
        row("year-2026", "113178", "2027-06-30"),
        row("not-held", "113177", "2029-06-30"),
      ],
      total: 3,
    });

    const status = await computeMembershipStatus(1_715_738, now);

    expect(getCustomerCategories).toHaveBeenCalledWith(1_715_738);
    expect(listRows).toHaveBeenCalledWith("app", "memberships", [
      "equal(status,true)",
      "limit(200)",
    ]);
    expect(status.isMember).toBe(true);
    expect(status.memberships.map((m) => m.id)).toEqual(["year-2026"]);
    expect(status.expiredMemberships?.map((m) => m.id)).toEqual([
      "spring-2026",
    ]);
    expect(status.reason).toBeUndefined();
  });

  it("reports an expired membership, newest expiry first", async () => {
    getCustomerCategories.mockResolvedValue([1, 2]);
    listRows.mockResolvedValue({
      rows: [row("older", "1", "2025-12-31"), row("newer", "2", "2026-06-30")],
      total: 2,
    });

    const status = await computeMembershipStatus(1_715_738, now);

    expect(status.isMember).toBe(false);
    expect(status.reason).toBe("expired");
    expect(status.memberships).toEqual([]);
    expect(status.expiredMemberships?.map((m) => m.id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("counts a held row whose dates are written DD.MM.YYYY", async () => {
    getCustomerCategories.mockResolvedValue([113_176]);
    listRows.mockResolvedValue({
      rows: [{ ...row("54", "113176", "31.12.2026"), startDate: "01.07.2026" }],
      total: 1,
    });

    const status = await computeMembershipStatus(1_715_738, now);

    expect(status.isMember).toBe(true);
    expect(status.memberships).toEqual([
      expect.objectContaining({
        expiryDate: "2026-12-31",
        id: "54",
        startDate: "2026-07-01",
      }),
    ]);
  });

  it("orders expired memberships by date, whatever form they are written in", async () => {
    getCustomerCategories.mockResolvedValue([1, 2]);
    listRows.mockResolvedValue({
      rows: [row("older", "1", "31.12.2025"), row("newer", "2", "2026-06-30")],
      total: 2,
    });

    const status = await computeMembershipStatus(1_715_738, now);

    expect(status.expiredMemberships?.map((m) => m.id)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("does not count a matched row with an unreadable expiry", async () => {
    getCustomerCategories.mockResolvedValue([1]);
    listRows.mockResolvedValue({ rows: [row("bad", "1", "soon")], total: 1 });

    const status = await computeMembershipStatus(1_715_738, now);

    expect(status.isMember).toBe(false);
    expect(status.expiredMemberships?.map((m) => m.id)).toEqual(["bad"]);
  });

  it("still reports a customer with no categories as not a member", async () => {
    getCustomerCategories.mockResolvedValue([]);

    const status = await computeMembershipStatus(1_715_738, now);

    expect(status).toMatchObject({
      expiredMemberships: [],
      isMember: false,
      reason: "no_categories",
    });
    expect(listRows).not.toHaveBeenCalled();
  });
});

describe("pickCurrentMembership", () => {
  const info = (id: string, expiryDate: string) => ({
    category: "1",
    expiryDate,
    id,
    name: id,
    startDate: "2026-07-01",
  });

  it("returns the membership that runs longest", () => {
    expect(
      pickCurrentMembership([
        info("semester", "2026-12-31"),
        info("three-years", "2029-07-01"),
        info("year", "2027-07-01"),
      ])?.id
    ).toBe("three-years");
  });

  it("returns null for no memberships", () => {
    expect(pickCurrentMembership([])).toBeNull();
  });
});
