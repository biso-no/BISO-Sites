import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signWebPassCode } from "@repo/shared/utils/member-pass";
import { passSlot } from "@repo/shared/utils/member-pass-slots";
import type { UserAuthContext } from "@/lib/authorization";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const SCAN_URL_RE = /^https:\/\/admin\.biso\.no\/scan\/[A-Za-z0-9_-]{43}$/;
const TOKEN_HASH_RE = /^[0-9a-f]{64}$/;

const baseCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "staff@biso.no",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["1"],
  name: "Staff",
  resolvedCampusIds: ["1"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "staff-1",
};
let ctx: UserAuthContext = baseCtx;

const db = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};
// Real `getScanMembershipStatus` (and the real `computeMembershipStatus` it
// wraps) runs against this fake `db`, because `membership-lookup.test.ts`
// imports the real module and bun's module mocks leak across test files in
// one `bun test` run — mocking "@/lib/member-pass/membership-lookup" here
// would poison that other file. Instead only its two external dependencies,
// `next/cache` and the Finago connector, are mocked.
const getCustomerCategories = mock();

mock.module("@/lib/authorization", () => ({
  requireNavAccess: mock(async () => ctx),
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));
// `cookies` is included alongside `headers` even though this file's code
// under test never calls it: `mock.module("next/headers", ...)` replaces the
// whole module process-wide, and src/lib/authorization.test.ts (which does
// call `cookies()`) shares this registry entry within the same `bun test`
// run — whichever file's factory is registered last would otherwise strip
// the export the other needs. The shape here matches authorization.test.ts's
// own stub so it behaves the same either way.
mock.module("next/headers", () => ({
  cookies: mock(async () => ({
    get: mock(() => undefined),
  })),
  headers: mock(
    async () =>
      new Headers({ host: "admin.biso.no", "x-forwarded-proto": "https" })
  ),
}));
mock.module("next/cache", () => ({
  unstable_cache:
    (fn: (...args: unknown[]) => unknown) =>
    (...args: unknown[]) =>
      fn(...args),
}));
mock.module("@repo/connectors/24sevenoffice", () => ({
  getCustomerCategories,
}));

const actions = await import("./member-pass");

describe("member pass actions", () => {
  beforeEach(() => {
    ctx = baseCtx;
    process.env.MEMBER_PASS_SECRET = SECRET;
    for (const fn of [...Object.values(db), getCustomerCategories]) {
      fn.mockReset();
    }
    db.createRow.mockImplementation(async (_db, _table, id, data) => ({
      $id: id,
      ...data,
    }));
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
  });

  test("scans as the signed-in staff member", async () => {
    db.getRow.mockResolvedValue({ $id: "m1", name: "M", student_id: "s1" });
    getCustomerCategories.mockResolvedValue([1]);
    db.listRows.mockImplementation((_dbName: string, table: string) => {
      if (table === "memberships") {
        return Promise.resolve({
          rows: [
            {
              $id: "54",
              category: "1",
              expiryDate: "2099-12-31",
              name: "Semester",
              startDate: "2099-07-01",
              status: true,
            },
          ],
          total: 1,
        });
      }
      return Promise.resolve({ rows: [], total: 0 });
    });
    const code = signWebPassCode("m1", passSlot(Date.now()), SECRET);
    const result = await actions.scanMemberPass(` ${code} `);
    expect(result).toEqual({
      data: {
        expiryDate: "2099-12-31",
        membershipName: "Semester",
        name: "M",
        result: "valid",
      },
      success: true,
    });
    expect(db.createRow.mock.calls[0]?.[3]).toMatchObject({
      member_user_id: "m1",
      scanner_user_id: "staff-1",
    });
  });

  test("refuses to scan without a secret", async () => {
    process.env.MEMBER_PASS_SECRET = "";
    expect(await actions.scanMemberPass("code")).toEqual({
      error: "not_configured",
      success: false,
    });
  });

  test("creates a link for a managed campus and returns its url once", async () => {
    const result = await actions.createScannerLink({
      campusId: "1",
      expiresAt: null,
      label: "  Fadderuke  ",
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.url).toMatch(SCAN_URL_RE);
    expect(result.data.link).toMatchObject({
      campusId: "1",
      label: "Fadderuke",
    });
    const stored = db.createRow.mock.calls[0]?.[3];
    expect(stored.token_hash).toMatch(TOKEN_HASH_RE);
    expect(result.data.url).not.toContain(stored.token_hash);
  });

  test("blocks campus admins from other campuses and from campus-less links", async () => {
    for (const campusId of ["2", null]) {
      expect(
        await actions.createScannerLink({
          campusId,
          expiresAt: null,
          label: "X",
        })
      ).toEqual({ error: "forbidden_campus", success: false });
    }
  });

  test("validates label and expiry", async () => {
    expect(
      await actions.createScannerLink({
        campusId: "1",
        expiresAt: null,
        label: " ",
      })
    ).toEqual({ error: "invalid_label", success: false });
    expect(
      await actions.createScannerLink({
        campusId: "1",
        expiresAt: "2000-01-01T00:00:00Z",
        label: "X",
      })
    ).toEqual({ error: "invalid_expiry", success: false });
  });

  test("scopes the link list by campus for campus admins only", async () => {
    await actions.listScannerLinks();
    expect(JSON.stringify(db.listRows.mock.calls[0]?.[2])).toContain(
      "campus_id"
    );
    ctx = { ...baseCtx, roles: ["globaladmin"] };
    await actions.listScannerLinks();
    expect(JSON.stringify(db.listRows.mock.calls[1]?.[2])).not.toContain(
      "campus_id"
    );
  });

  test("revokes only links the caller may manage", async () => {
    db.getRow.mockResolvedValue({ $id: "l1", campus_id: "2" });
    expect(await actions.revokeScannerLink("l1")).toEqual({
      error: "forbidden_campus",
      success: false,
    });
    db.getRow.mockResolvedValue({ $id: "l1", campus_id: "1" });
    expect(await actions.revokeScannerLink("l1")).toEqual({
      data: null,
      success: true,
    });
    expect(db.updateRow).toHaveBeenCalledTimes(1);
    db.getRow.mockRejectedValue(
      Object.assign(new Error("not found"), { code: 404 })
    );
    expect(await actions.revokeScannerLink("nope")).toEqual({
      error: "not_found",
      success: false,
    });
  });
});
