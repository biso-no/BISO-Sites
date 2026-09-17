import { beforeEach, describe, expect, mock, test } from "bun:test";
import { signWebPassCode } from "@repo/shared/utils/member-pass";
import { passSlot } from "@repo/shared/utils/member-pass-slots";
import { hashGuestToken } from "@/lib/member-pass/guest-links";

const SECRET = "test-secret-that-is-at-least-32-characters-long";
const TOKEN = "guest-token";

const db = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
};
// `getScanMembershipStatus` runs for real against this fake `db` — its own
// test (membership-lookup.test.ts) imports the real module, and bun's
// module mocks leak across test files in one `bun test` run, so mocking
// "@/lib/member-pass/membership-lookup" here would poison that other file.
// Only its two external dependencies, `next/cache` and the Finago
// connector, are mocked, matching the pattern in
// src/app/(portal)/_actions/member-pass.test.ts.
const getCustomerCategories = mock();

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
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

const { resolveGuestLink, scanWithGuestLink } = await import("./actions");

const liveLink = {
  $id: "link-1",
  expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  revoked_at: null,
  token_hash: hashGuestToken(TOKEN),
};

describe("guest scanner", () => {
  beforeEach(() => {
    process.env.MEMBER_PASS_SECRET = SECRET;
    for (const fn of [...Object.values(db), getCustomerCategories]) {
      fn.mockReset();
    }
    db.listRows.mockImplementation((_db, table) => {
      if (table === "member_pass_scanner_links") {
        return { rows: [liveLink], total: 1 };
      }
      if (table === "memberships") {
        return {
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
        };
      }
      return { rows: [], total: 0 };
    });
    db.createRow.mockResolvedValue({});
    db.getRow.mockResolvedValue({ $id: "m1", name: "M", student_id: "s1" });
    getCustomerCategories.mockResolvedValue([1]);
  });

  test("looks the link up by the hash of its token", async () => {
    expect(await resolveGuestLink(TOKEN)).toMatchObject({ $id: "link-1" });
    expect(JSON.stringify(db.listRows.mock.calls[0]?.[2])).toContain(
      hashGuestToken(TOKEN)
    );
  });

  test("scans on behalf of the link", async () => {
    const code = signWebPassCode("m1", passSlot(Date.now()), SECRET);
    const result = await scanWithGuestLink(TOKEN, code);
    expect(result).toMatchObject({
      data: { name: "M", result: "valid" },
      success: true,
    });
    const scanRow = db.createRow.mock.calls.find(
      (call) => call[1] === "member_pass_scans"
    )?.[3];
    expect(scanRow).toMatchObject({
      scanner_link_id: "link-1",
      scanner_user_id: null,
    });
  });

  test("refuses revoked or expired links", async () => {
    for (const link of [
      { ...liveLink, revoked_at: new Date().toISOString() },
      { ...liveLink, expires_at: new Date(Date.now() - 1000).toISOString() },
    ]) {
      db.listRows.mockResolvedValue({ rows: [link], total: 1 });
      expect(await scanWithGuestLink(TOKEN, "code")).toEqual({
        error: "invalid_link",
        success: false,
      });
    }
  });

  test("rate limits a busy link", async () => {
    db.listRows.mockImplementation((_db, table) =>
      table === "member_pass_scanner_links"
        ? { rows: [{ ...liveLink, $id: "busy-link" }], total: 1 }
        : { rows: [], total: 0 }
    );
    let last: unknown;
    for (let i = 0; i < 61; i += 1) {
      last = await scanWithGuestLink(TOKEN, "v1.bad");
    }
    expect(last).toEqual({ error: "rate_limited", success: false });
  });
});
