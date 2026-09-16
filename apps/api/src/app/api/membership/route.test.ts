import { beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({ get: vi.fn() }));
const getRow = vi.hoisted(() => vi.fn());
const getMembershipStatusForStudent = vi.hoisted(() => vi.fn());
const getPurchasableMembershipPlans = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@repo/connectors/24sevenoffice", () => ({
  getCustomerCategories: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  createAuthenticatedClient: vi.fn(async () => ({ account })),
}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db: { getRow } })),
}));
vi.mock("@/lib/membership-status-cache", () => ({
  getMembershipStatusForStudent,
}));
vi.mock("@repo/shared/utils/membership-catalog", () => ({
  getPurchasableMembershipPlans,
}));

import { GET } from "./route";

const PLAN = {
  accrualMonths: 12,
  categoryId: 113_178,
  duration: "year",
  expiryDate: "2027-06-30",
  id: "71",
  name: "BISO Membership fall 2026 and spring 2027",
  price: 550,
  productId: 71,
  startDate: "2026-08-01",
};

const LINKED_PROFILE = {
  $id: "user-1",
  bi_campus_id: "2",
  bi_employee_id: "1015882",
  student_id: "s1715738",
};

function status(overrides: Record<string, unknown> = {}) {
  return {
    checkedAt: Date.parse("2026-09-15T08:00:00.000Z"),
    expiredMemberships: [],
    finagoCategoryIds: [],
    isMember: false,
    memberships: [],
    reason: "no_categories",
    ...overrides,
  };
}

function overviewRequest(query = "", authorization = "Bearer jwt") {
  const headers = new Headers();
  if (authorization) {
    headers.set("authorization", authorization);
  }
  return new Request(`https://api.biso.no/api/membership${query}`, {
    headers,
  }) as never;
}

describe("GET /api/membership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    account.get.mockResolvedValue({ $id: "user-1" });
    getRow.mockResolvedValue(LINKED_PROFILE);
    getMembershipStatusForStudent.mockResolvedValue(status());
    getPurchasableMembershipPlans.mockResolvedValue([PLAN]);
  });

  it("requires a bearer token", async () => {
    const response = await GET(overviewRequest("", ""));

    expect(response.status).toBe(401);
    expect(getRow).not.toHaveBeenCalled();
  });

  it("asks an unlinked student to link, without touching 24SevenOffice", async () => {
    getRow.mockResolvedValue({ $id: "user-1", student_id: null });

    const body = await (await GET(overviewRequest())).json();

    expect(body).toMatchObject({
      isMember: false,
      offeredPlans: [],
      state: "needs_bi_link",
      studentId: null,
    });
    expect(body.campuses.map((c: { id: string }) => c.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
    expect(getMembershipStatusForStudent).not.toHaveBeenCalled();
  });

  it("offers plans to a linked non-member", async () => {
    const response = await GET(overviewRequest());
    const body = await response.json();

    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getMembershipStatusForStudent).toHaveBeenCalledWith(1_715_738, {
      refresh: false,
    });
    expect(body).toMatchObject({
      checkedAt: "2026-09-15T08:00:00.000Z",
      currentExpiry: null,
      defaultCampusId: "2",
      isMember: false,
      reason: "no_categories",
      state: "eligible",
      studentId: "s1715738",
    });
    expect(body.offeredPlans).toEqual([
      {
        accrualMonths: 12,
        duration: "year",
        expiryDate: "2027-06-30",
        id: "71",
        name: "BISO Membership fall 2026 and spring 2027",
        price: 550,
        startDate: "2026-08-01",
      },
    ]);
  });

  it("tells a member whose cover already reaches the plan's end that they are covered", async () => {
    const membership = {
      category: "113178",
      expiryDate: "2027-06-30",
      id: "71",
      name: "BISO Membership fall 2026 and spring 2027",
      startDate: "2026-08-01",
    };
    getMembershipStatusForStudent.mockResolvedValue(
      status({ isMember: true, memberships: [membership], reason: undefined })
    );

    const body = await (await GET(overviewRequest())).json();

    expect(body).toMatchObject({
      currentExpiry: "2027-06-30",
      isMember: true,
      memberships: [membership],
      offeredPlans: [],
      reason: null,
      state: "already_member",
    });
  });

  it("forces a refresh when asked", async () => {
    await GET(overviewRequest("?refresh=1"));

    expect(getMembershipStatusForStudent).toHaveBeenCalledWith(1_715_738, {
      refresh: true,
    });
  });

  it("reports an unavailable check instead of 'not a member' when 24SevenOffice fails", async () => {
    getMembershipStatusForStudent.mockResolvedValue(
      status({ reason: "finago_error" })
    );

    const body = await (await GET(overviewRequest())).json();

    expect(body).toMatchObject({
      offeredPlans: [],
      reason: "finago_error",
      state: "membership_check_unavailable",
    });
  });

  it("reports an unavailable check when the profile cannot be read", async () => {
    getRow.mockRejectedValue(
      Object.assign(new Error("timeout"), { code: 500 })
    );

    const body = await (await GET(overviewRequest())).json();

    expect(body).toMatchObject({
      reason: "profile_unavailable",
      state: "membership_check_unavailable",
    });
    expect(getMembershipStatusForStudent).not.toHaveBeenCalled();
  });

  it("reports an unavailable check when the catalog cannot be read", async () => {
    getPurchasableMembershipPlans.mockRejectedValue(new Error("appwrite down"));

    const body = await (await GET(overviewRequest())).json();

    expect(body).toMatchObject({
      reason: "catalog_unavailable",
      state: "membership_check_unavailable",
    });
  });
});
