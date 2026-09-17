import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";

const db = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};

const {
  createLinkRow,
  findLatestCountedScan,
  findLinkByTokenHash,
  listLiveLinks,
  recordScan,
  revokeLinkRow,
} = await import("./store");

const adminDb = db as any;

describe("member pass store", () => {
  beforeEach(() => {
    for (const fn of Object.values(db)) {
      fn.mockReset();
    }
  });

  test("finds the latest counted scan since a time", async () => {
    db.listRows.mockResolvedValue({ rows: [{ $id: "s1" }], total: 1 });
    const since = new Date("2026-09-17T09:50:00Z");
    // Cast to unknown: the mock only returns a partial row, and
    // findLatestCountedScan's return type is the full MemberPassScanRow.
    expect(
      (await findLatestCountedScan(adminDb, "u1", since)) as unknown
    ).toEqual({ $id: "s1" });
    expect(db.listRows).toHaveBeenCalledWith("app", "member_pass_scans", [
      Query.equal("member_user_id", "u1"),
      Query.equal("result", ["valid", "duplicate", "check_id"]),
      Query.greaterThan("$createdAt", since.toISOString()),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
  });

  test("records a guest scan without a staff user", async () => {
    db.createRow.mockResolvedValue({});
    await recordScan(adminDb, {
      codeKind: "web",
      memberUserId: "u1",
      reason: null,
      result: "valid",
      scanner: { kind: "guest", linkId: "l1" },
    });
    const [, table, , data, permissions] = db.createRow.mock.calls[0] ?? [];
    expect(table).toBe("member_pass_scans");
    expect(data).toEqual({
      code_kind: "web",
      member_user_id: "u1",
      reason: null,
      result: "valid",
      scanner_link_id: "l1",
      scanner_user_id: null,
    });
    expect(permissions).toEqual([]);
  });

  test("looks a link up by token hash", async () => {
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    expect(await findLinkByTokenHash(adminDb, "abc")).toBeNull();
    expect(db.listRows).toHaveBeenCalledWith(
      "app",
      "member_pass_scanner_links",
      [Query.equal("token_hash", "abc"), Query.limit(1)]
    );
  });

  test("creates, revokes and lists links", async () => {
    db.createRow.mockResolvedValue({ $id: "l1" });
    const expiresAt = new Date("2026-09-17T22:00:00Z");
    await createLinkRow(adminDb, {
      campusId: "1",
      createdBy: "staff-1",
      expiresAt,
      label: "Fadderuke",
      tokenHash: "h",
    });
    expect(db.createRow.mock.calls[0]?.[3]).toEqual({
      campus_id: "1",
      created_by: "staff-1",
      expires_at: expiresAt.toISOString(),
      label: "Fadderuke",
      revoked_at: null,
      token_hash: "h",
    });

    const now = new Date("2026-09-17T12:00:00Z");
    await revokeLinkRow(adminDb, "l1", now);
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "member_pass_scanner_links",
      "l1",
      {
        revoked_at: now.toISOString(),
      }
    );

    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    await listLiveLinks(adminDb, now, ["1", "2"]);
    expect(db.listRows).toHaveBeenLastCalledWith(
      "app",
      "member_pass_scanner_links",
      [
        Query.greaterThan("expires_at", now.toISOString()),
        Query.isNull("revoked_at"),
        Query.orderAsc("expires_at"),
        Query.limit(100),
        Query.equal("campus_id", ["1", "2"]),
      ]
    );
  });
});
