import { Query } from "@repo/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = {
  createRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
};

const {
  createGrant,
  findActiveGrantForUser,
  findActiveGrantForUserAndCampus,
  getGrant,
  grantStatus,
  isGrantActive,
  listGrants,
  revokeGrant,
  SCANNER_GRANTS_TABLE,
  updateGrant,
} = await import("./scanner-grants");

const adminDb = db as any;

describe("grantStatus / isGrantActive", () => {
  it("is active when not revoked and expires_at is null", () => {
    const grant = { expires_at: null, revoked_at: null };
    const now = new Date("2026-09-17T12:00:00Z");
    expect(grantStatus(grant, now)).toBe("active");
    expect(isGrantActive(grant, now)).toBe(true);
  });

  it("is expired exactly at the expiry instant", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    const grant = { expires_at: now.toISOString(), revoked_at: null };
    expect(grantStatus(grant, now)).toBe("expired");
    expect(isGrantActive(grant, now)).toBe(false);
  });

  it("is active one millisecond before expires_at", () => {
    const expiresAt = new Date("2026-09-17T12:00:00.001Z");
    const now = new Date("2026-09-17T12:00:00.000Z");
    const grant = { expires_at: expiresAt.toISOString(), revoked_at: null };
    expect(grantStatus(grant, now)).toBe("active");
    expect(isGrantActive(grant, now)).toBe(true);
  });

  it("is expired one millisecond after expires_at", () => {
    const expiresAt = new Date("2026-09-17T12:00:00.000Z");
    const now = new Date("2026-09-17T12:00:00.001Z");
    const grant = { expires_at: expiresAt.toISOString(), revoked_at: null };
    expect(grantStatus(grant, now)).toBe("expired");
    expect(isGrantActive(grant, now)).toBe(false);
  });

  it("is revoked when revoked_at is set, even before expiry", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    const grant = {
      expires_at: new Date("2026-09-18T12:00:00Z").toISOString(),
      revoked_at: new Date("2026-09-17T00:00:00Z").toISOString(),
    };
    expect(grantStatus(grant, now)).toBe("revoked");
    expect(isGrantActive(grant, now)).toBe(false);
  });
});

describe("scanner grants store", () => {
  beforeEach(() => {
    for (const fn of Object.values(db)) {
      fn.mockReset();
    }
  });

  it("finds the active grant for a user", async () => {
    const row = {
      $createdAt: "2026-09-17T00:00:00Z",
      $id: "g1",
      campus_id: null,
      email: "a@b.no",
      expires_at: null,
      granted_by: "staff-1",
      invited_at: null,
      name: null,
      revoked_at: null,
      user_id: "u1",
    };
    db.listRows.mockResolvedValue({ rows: [row], total: 1 });
    const now = new Date("2026-09-17T12:00:00Z");
    expect(await findActiveGrantForUser(adminDb, "u1", now)).toEqual(row);
    expect(db.listRows).toHaveBeenCalledWith("app", SCANNER_GRANTS_TABLE, [
      Query.equal("user_id", "u1"),
      Query.isNull("revoked_at"),
      Query.or([
        Query.isNull("expires_at"),
        Query.greaterThan("expires_at", now.toISOString()),
      ]),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
  });

  it("returns null from findActiveGrantForUser when no row is active", async () => {
    const expiredRow = {
      $createdAt: "2026-09-17T00:00:00Z",
      $id: "g1",
      campus_id: null,
      email: "a@b.no",
      expires_at: new Date("2026-09-01T00:00:00Z").toISOString(),
      granted_by: "staff-1",
      invited_at: null,
      name: null,
      revoked_at: null,
      user_id: "u1",
    };
    db.listRows.mockResolvedValue({ rows: [expiredRow], total: 1 });
    const now = new Date("2026-09-17T12:00:00Z");
    expect(await findActiveGrantForUser(adminDb, "u1", now)).toBeNull();
  });

  it("finds the active grant for a user and campus", async () => {
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    const now = new Date("2026-09-17T12:00:00Z");
    await findActiveGrantForUserAndCampus(adminDb, "u1", "1", now);
    expect(db.listRows).toHaveBeenCalledWith("app", SCANNER_GRANTS_TABLE, [
      Query.equal("user_id", "u1"),
      Query.isNull("revoked_at"),
      Query.or([
        Query.isNull("expires_at"),
        Query.greaterThan("expires_at", now.toISOString()),
      ]),
      Query.equal("campus_id", "1"),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
  });

  it("matches a null campusId with isNull", async () => {
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    const now = new Date("2026-09-17T12:00:00Z");
    await findActiveGrantForUserAndCampus(adminDb, "u1", null, now);
    expect(db.listRows).toHaveBeenCalledWith("app", SCANNER_GRANTS_TABLE, [
      Query.equal("user_id", "u1"),
      Query.isNull("revoked_at"),
      Query.or([
        Query.isNull("expires_at"),
        Query.greaterThan("expires_at", now.toISOString()),
      ]),
      Query.isNull("campus_id"),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);
  });

  it("lists grants newest first, limit 200, for all campuses", async () => {
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    await listGrants(adminDb, null);
    expect(db.listRows).toHaveBeenCalledWith("app", SCANNER_GRANTS_TABLE, [
      Query.orderDesc("$createdAt"),
      Query.limit(200),
    ]);
  });

  it("lists grants scoped to campus ids", async () => {
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    await listGrants(adminDb, ["1", "2"]);
    expect(db.listRows).toHaveBeenCalledWith("app", SCANNER_GRANTS_TABLE, [
      Query.orderDesc("$createdAt"),
      Query.limit(200),
      Query.equal("campus_id", ["1", "2"]),
    ]);
  });

  it("gets a grant by id", async () => {
    const row = { $id: "g1" };
    db.getRow.mockResolvedValue(row);
    expect((await getGrant(adminDb, "g1")) as unknown).toEqual(row);
    expect(db.getRow).toHaveBeenCalledWith("app", SCANNER_GRANTS_TABLE, "g1");
  });

  it("returns null from getGrant on any error", async () => {
    db.getRow.mockRejectedValue(new Error("not found"));
    expect(await getGrant(adminDb, "missing")).toBeNull();
  });

  it("creates a grant with no row permissions", async () => {
    const created = { $id: "g1" };
    db.createRow.mockResolvedValue(created);
    const expiresAt = new Date("2026-10-17T00:00:00Z");
    const result = await createGrant(adminDb, {
      campusId: "1",
      email: "a@b.no",
      expiresAt,
      grantedBy: "staff-1",
      name: "Alice",
      userId: "u1",
    });
    expect(result).toEqual(created);
    const [db_, table, , data, permissions] = db.createRow.mock.calls[0] ?? [];
    expect(db_).toBe("app");
    expect(table).toBe(SCANNER_GRANTS_TABLE);
    expect(data).toEqual({
      campus_id: "1",
      email: "a@b.no",
      expires_at: expiresAt.toISOString(),
      granted_by: "staff-1",
      invited_at: null,
      name: "Alice",
      revoked_at: null,
      user_id: "u1",
    });
    expect(permissions).toEqual([]);
  });

  it("creates a grant with null campusId, expiresAt and name", async () => {
    db.createRow.mockResolvedValue({ $id: "g1" });
    await createGrant(adminDb, {
      campusId: null,
      email: "a@b.no",
      expiresAt: null,
      grantedBy: "staff-1",
      name: null,
      userId: "u1",
    });
    const [, , , data] = db.createRow.mock.calls[0] ?? [];
    expect(data).toEqual({
      campus_id: null,
      email: "a@b.no",
      expires_at: null,
      granted_by: "staff-1",
      invited_at: null,
      name: null,
      revoked_at: null,
      user_id: "u1",
    });
  });

  it("updates a grant with the given patch", async () => {
    await updateGrant(adminDb, "g1", { name: "New Name" });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      SCANNER_GRANTS_TABLE,
      "g1",
      {
        name: "New Name",
      }
    );
  });

  it("revokes a grant", async () => {
    const now = new Date("2026-09-17T12:00:00Z");
    await revokeGrant(adminDb, "g1", now);
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      SCANNER_GRANTS_TABLE,
      "g1",
      {
        revoked_at: now.toISOString(),
      }
    );
  });
});
