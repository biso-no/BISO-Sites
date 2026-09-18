import { createAdminClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthenticatedClient } from "@/lib/auth";
import { getMembershipStatusForStudent } from "@/lib/membership-status-cache";
import { PUT } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth", () => ({ createAuthenticatedClient: vi.fn() }));
vi.mock("@/lib/membership-status-cache", () => ({
  getMembershipStatusForStudent: vi.fn(),
}));
// A cached "not a member" is re-checked live before anyone is refused, so this
// is the lookup that decides the outcome for a non-member.
vi.mock("@repo/shared/utils/membership-status", () => ({
  computeMembershipStatus: liveMembership,
}));

const liveMembership = vi.hoisted(() => vi.fn());
const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedCreateAuthenticatedClient = vi.mocked(createAuthenticatedClient);
const mockedMembership = vi.mocked(getMembershipStatusForStudent);

/**
 * `getRow` answers per table, because the members-only gate reads the buyer's
 * profile from `user` in addition to the product row.
 */
function mockDb({
  memberOnly,
  studentId = "s1234567",
}: {
  memberOnly: boolean;
  studentId?: string | null;
}) {
  const db = {
    createRow: vi.fn().mockResolvedValue({}),
    deleteRow: vi.fn().mockResolvedValue({}),
    getRow: vi.fn((_db: string, table: string) =>
      Promise.resolve(
        table === "user"
          ? { student_id: studentId }
          : { member_only: memberOnly, status: "published", stock: null }
      )
    ),
    listRows: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    updateRow: vi.fn().mockResolvedValue({}),
  };
  mockedCreateAdminClient.mockResolvedValue({ db } as unknown as Awaited<
    ReturnType<typeof createAdminClient>
  >);
  return db;
}

const putRequest = (): NextRequest =>
  new Request("https://api.biso.no/api/shop/cart", {
    body: JSON.stringify({ productId: "product-1", quantity: 1 }),
    headers: new Headers({
      authorization: "Bearer valid",
      "content-type": "application/json",
    }),
    method: "PUT",
  }) as unknown as NextRequest;

describe("holding stock of a members-only product", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the live re-check agrees with the cache unless a test says so.
    liveMembership.mockResolvedValue({ isMember: false });
    mockedCreateAuthenticatedClient.mockResolvedValue({
      account: { get: vi.fn().mockResolvedValue({ $id: "buyer-1" }) },
    } as unknown as Awaited<ReturnType<typeof createAuthenticatedClient>>);
  });

  it("refuses a non-member, so members-only stock is not held away from members", async () => {
    mockDb({ memberOnly: true });
    mockedMembership.mockResolvedValue({ isMember: false } as Awaited<
      ReturnType<typeof getMembershipStatusForStudent>
    >);

    const response = await PUT(putRequest());

    expect(response.status).toBe(403);
  });

  it("lets a member hold it", async () => {
    const db = mockDb({ memberOnly: true });
    mockedMembership.mockResolvedValue({ isMember: true } as Awaited<
      ReturnType<typeof getMembershipStatusForStudent>
    >);

    const response = await PUT(putRequest());

    expect(response.status).toBe(200);
    expect(db.createRow).toHaveBeenCalled();
  });

  it("refuses a buyer with no student number rather than assuming membership", async () => {
    mockDb({ memberOnly: true, studentId: null });

    const response = await PUT(putRequest());

    expect(response.status).toBe(403);
    // No point asking 24SevenOffice about a student number we do not have.
    expect(mockedMembership).not.toHaveBeenCalled();
  });

  it("leaves an open product alone", async () => {
    mockDb({ memberOnly: false });

    const response = await PUT(putRequest());

    expect(response.status).toBe(200);
    expect(mockedMembership).not.toHaveBeenCalled();
  });

  it("re-checks live for a student the cache has not caught up with", async () => {
    // Someone who paid for their membership a moment ago is still `false` in
    // the ten-minute cache. Refusing them there would block the very purchase
    // they joined to make, so a cached "no" is never the final answer.
    const db = mockDb({ memberOnly: true });
    mockedMembership.mockResolvedValue({ isMember: false } as Awaited<
      ReturnType<typeof getMembershipStatusForStudent>
    >);
    liveMembership.mockResolvedValue({ isMember: true });

    const response = await PUT(putRequest());

    expect(response.status).toBe(200);
    expect(db.createRow).toHaveBeenCalled();
  });

  it("does not pay for a live lookup when the cache already says yes", async () => {
    mockDb({ memberOnly: true });
    mockedMembership.mockResolvedValue({ isMember: true } as Awaited<
      ReturnType<typeof getMembershipStatusForStudent>
    >);

    const response = await PUT(putRequest());

    expect(response.status).toBe(200);
    expect(liveMembership).not.toHaveBeenCalled();
  });
});
