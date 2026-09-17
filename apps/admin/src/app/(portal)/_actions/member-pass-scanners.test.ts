import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.biso.no";
const FUTURE = "2099-01-01T00:00:00.000Z";

const campusAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "leder@biso.no",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["1"],
  name: "Kari Leder",
  resolvedCampusIds: ["1"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "staff-1",
};
const globalAdminCtx: UserAuthContext = {
  ...campusAdminCtx,
  managedCampuses: [],
  managedCampusIds: [],
  name: "Global Admin",
  roles: ["globaladmin"],
  userId: "global-1",
};
let ctx: UserAuthContext = campusAdminCtx;

const db = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};
const users = {
  create: mock(),
  get: mock(),
  list: mock(),
};
// Same export names as varsling.test.ts's mock of this module: bun's module
// mocks are process-wide, so both files must provide the same shape.
const sendEmail = mock();
const isSmtpConfigured = mock(() => true);
const logAuditEvent = mock(async () => undefined);

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => ctx),
  requireNavAccess: mock(async () => ctx),
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db, users })),
}));
mock.module("@repo/connectors/email", () => ({ isSmtpConfigured, sendEmail }));
mock.module("./audit-log", () => ({ logAuditEvent }));

const actions = await import("./member-pass-scanners");

function grantRow(overrides: Record<string, unknown> = {}) {
  return {
    $createdAt: "2026-09-01T00:00:00.000Z",
    $id: "g1",
    campus_id: "1",
    email: "guard@example.com",
    expires_at: null,
    granted_by: "staff-1",
    invited_at: null,
    name: "Guard",
    revoked_at: null,
    user_id: "u1",
    ...overrides,
  };
}

const auditActions = () =>
  logAuditEvent.mock.calls.map((call) => (call as unknown[])[1]);

describe("member pass scanner actions", () => {
  beforeEach(() => {
    ctx = campusAdminCtx;
    process.env.BISO_APP_IOS_URL = "https://apps.apple.com/app/biso/id1";
    process.env.BISO_APP_ANDROID_URL = "";
    for (const fn of [
      ...Object.values(db),
      ...Object.values(users),
      sendEmail,
      logAuditEvent,
    ]) {
      fn.mockReset();
    }
    isSmtpConfigured.mockReset();
    isSmtpConfigured.mockImplementation(() => true);
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    db.createRow.mockImplementation(async (_db, _table, id, data) => ({
      $createdAt: "2026-09-17T00:00:00.000Z",
      $id: id === "unique()" ? "new-grant" : id,
      ...data,
    }));
    db.updateRow.mockResolvedValue({});
    users.list.mockResolvedValue({ total: 0, users: [] });
    users.create.mockImplementation(async ({ email, name }) => ({
      $id: "new-user",
      email,
      name: name ?? "",
    }));
    users.get.mockImplementation(async ({ userId }) => ({
      $id: userId,
      name: userId === "staff-1" ? "Kari Leder" : "",
    }));
    sendEmail.mockResolvedValue({ accepted: [], messageId: "m", rejected: [] });
  });

  describe("inviteScanner", () => {
    test("creates an Appwrite user for a new email and saves the grant", async () => {
      const result = await actions.inviteScanner({
        campusId: "1",
        email: "  Guard@Example.COM ",
        expiresAt: FUTURE,
        name: " Guard ",
      });
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.emailSent).toBe(true);
      expect(users.create).toHaveBeenCalledTimes(1);
      const created = users.create.mock.calls[0]?.[0];
      expect(created).toMatchObject({
        email: "guard@example.com",
        name: "Guard",
      });
      expect(typeof created.userId).toBe("string");
      expect(db.createRow).toHaveBeenCalledTimes(1);
      expect(db.createRow.mock.calls[0]?.[3]).toMatchObject({
        campus_id: "1",
        email: "guard@example.com",
        expires_at: FUTURE,
        granted_by: "staff-1",
        name: "Guard",
        user_id: "new-user",
      });
      expect(result.data.grant).toMatchObject({
        campusId: "1",
        email: "guard@example.com",
        status: "active",
      });
      expect(result.data.grant.invitedAt).not.toBeNull();
      // invited_at is stamped once the email went out.
      expect(db.updateRow.mock.calls[0]?.[3]).toHaveProperty("invited_at");
      expect(auditActions()).toEqual(["member_pass_scanner.invite"]);
    });

    test("sends the invitation to the address with app links", async () => {
      await actions.inviteScanner({
        campusId: "1",
        email: "guard@example.com",
        expiresAt: null,
        name: "",
      });
      const sent = sendEmail.mock.calls[0]?.[0];
      expect(sent.to).toBe("guard@example.com");
      expect(sent.text).toContain("Kari Leder");
      expect(sent.text).toContain("Oslo");
      expect(sent.text).toContain("https://apps.apple.com/app/biso/id1");
      expect(sent.text).toContain(PLAY_URL);
      expect(sent.html).toContain("guard@example.com");
    });

    test("says to search the App Store when no iOS link is configured", async () => {
      process.env.BISO_APP_IOS_URL = "";
      await actions.inviteScanner({
        campusId: "1",
        email: "guard@example.com",
        expiresAt: null,
        name: "",
      });
      const sent = sendEmail.mock.calls[0]?.[0];
      expect(sent.text).toContain('Search for "BISO" in the App Store');
    });

    test("reuses an existing Appwrite user", async () => {
      users.list.mockResolvedValue({
        total: 1,
        users: [{ $id: "u-existing", email: "guard@example.com", name: "G" }],
      });
      const result = await actions.inviteScanner({
        campusId: "1",
        email: "guard@example.com",
        expiresAt: null,
        name: "",
      });
      expect(result.success).toBe(true);
      expect(users.create).not.toHaveBeenCalled();
      const [query] = users.list.mock.calls[0] ?? [];
      expect(JSON.stringify(query)).toContain("guard@example.com");
      expect(db.createRow.mock.calls[0]?.[3]).toMatchObject({
        name: null,
        user_id: "u-existing",
      });
    });

    test("re-inviting for the same campus updates the active grant", async () => {
      users.list.mockResolvedValue({
        total: 1,
        users: [{ $id: "u1", email: "guard@example.com", name: "" }],
      });
      db.listRows.mockResolvedValue({ rows: [grantRow()], total: 1 });
      const result = await actions.inviteScanner({
        campusId: "1",
        email: "guard@example.com",
        expiresAt: FUTURE,
        name: "",
      });
      expect(result.success).toBe(true);
      expect(db.createRow).not.toHaveBeenCalled();
      expect(db.updateRow.mock.calls[0]?.[2]).toBe("g1");
      expect(db.updateRow.mock.calls[0]?.[3]).toMatchObject({
        expires_at: FUTURE,
        name: "Guard",
      });
      const lookup = JSON.stringify(db.listRows.mock.calls[0]?.[2]);
      expect(lookup).toContain("u1");
      expect(lookup).toContain("revoked_at");
      expect(lookup).toContain("campus_id");
      if (result.success) {
        expect(result.data.grant.id).toBe("g1");
        expect(result.data.grant.expiresAt).toBe(FUTURE);
      }
    });

    test("keeps the grant when SMTP is not configured", async () => {
      isSmtpConfigured.mockImplementation(() => false);
      const result = await actions.inviteScanner({
        campusId: "1",
        email: "guard@example.com",
        expiresAt: null,
        name: "",
      });
      expect(result).toMatchObject({
        data: { emailSent: false },
        success: true,
      });
      expect(db.createRow).toHaveBeenCalledTimes(1);
      expect(sendEmail).not.toHaveBeenCalled();
      expect(db.updateRow).not.toHaveBeenCalled();
    });

    test("keeps the grant when sending fails", async () => {
      sendEmail.mockRejectedValue(new Error("relay down"));
      const originalError = console.error;
      console.error = mock(() => undefined);
      try {
        const result = await actions.inviteScanner({
          campusId: "1",
          email: "guard@example.com",
          expiresAt: null,
          name: "",
        });
        expect(result).toMatchObject({
          data: { emailSent: false },
          success: true,
        });
      } finally {
        console.error = originalError;
      }
      expect(db.createRow).toHaveBeenCalledTimes(1);
      expect(db.updateRow).not.toHaveBeenCalled();
    });

    test("rejects an invalid email", async () => {
      for (const email of [
        "",
        "not-an-email",
        "a b@c.no",
        "x@y",
        `${"a".repeat(320)}@b.no`,
      ]) {
        expect(
          await actions.inviteScanner({
            campusId: "1",
            email,
            expiresAt: null,
            name: "",
          })
        ).toEqual({ error: "invalid_email", success: false });
      }
      expect(users.list).not.toHaveBeenCalled();
    });

    test("rejects an end date in the past or an invalid one", async () => {
      for (const expiresAt of ["2000-01-01T00:00:00.000Z", "garbage"]) {
        expect(
          await actions.inviteScanner({
            campusId: "1",
            email: "guard@example.com",
            expiresAt,
            name: "",
          })
        ).toEqual({ error: "invalid_expiry", success: false });
      }
      expect(db.createRow).not.toHaveBeenCalled();
    });

    test("blocks a campus admin from another campus and from all campuses", async () => {
      for (const campusId of ["2", null]) {
        expect(
          await actions.inviteScanner({
            campusId,
            email: "guard@example.com",
            expiresAt: null,
            name: "",
          })
        ).toEqual({ error: "forbidden_campus", success: false });
      }
      expect(users.list).not.toHaveBeenCalled();
      expect(db.createRow).not.toHaveBeenCalled();
    });

    test("lets a global admin grant all campuses", async () => {
      ctx = globalAdminCtx;
      const result = await actions.inviteScanner({
        campusId: null,
        email: "guard@example.com",
        expiresAt: null,
        name: "",
      });
      expect(result.success).toBe(true);
      expect(db.createRow.mock.calls[0]?.[3]).toMatchObject({
        campus_id: null,
        granted_by: "global-1",
      });
      expect(sendEmail.mock.calls[0]?.[0].text).toContain("all campuses");
    });

    test("reports failed when Appwrite errors", async () => {
      users.list.mockRejectedValue(new Error("boom"));
      const originalError = console.error;
      console.error = mock(() => undefined);
      try {
        expect(
          await actions.inviteScanner({
            campusId: "1",
            email: "guard@example.com",
            expiresAt: null,
            name: "",
          })
        ).toEqual({ error: "failed", success: false });
      } finally {
        console.error = originalError;
      }
    });
  });

  describe("resendScannerInvite", () => {
    test("sends again and stamps invited_at", async () => {
      db.getRow.mockResolvedValue(grantRow());
      const result = await actions.resendScannerInvite("g1");
      expect(result).toMatchObject({
        data: { emailSent: true },
        success: true,
      });
      expect(sendEmail.mock.calls[0]?.[0].to).toBe("guard@example.com");
      expect(db.updateRow.mock.calls[0]?.[2]).toBe("g1");
      expect(db.updateRow.mock.calls[0]?.[3]).toHaveProperty("invited_at");
      expect(auditActions()).toEqual(["member_pass_scanner.resend"]);
    });

    test("refuses grants on other campuses and missing grants", async () => {
      db.getRow.mockResolvedValue(grantRow({ campus_id: "2" }));
      expect(await actions.resendScannerInvite("g1")).toEqual({
        error: "forbidden_campus",
        success: false,
      });
      db.getRow.mockRejectedValue(new Error("missing"));
      expect(await actions.resendScannerInvite("nope")).toEqual({
        error: "not_found",
        success: false,
      });
      expect(sendEmail).not.toHaveBeenCalled();
    });

    test("refuses revoked or expired grants", async () => {
      for (const row of [
        grantRow({ revoked_at: "2026-09-01T00:00:00.000Z" }),
        grantRow({ expires_at: "2000-01-01T00:00:00.000Z" }),
      ]) {
        db.getRow.mockResolvedValue(row);
        expect(await actions.resendScannerInvite("g1")).toEqual({
          error: "not_active",
          success: false,
        });
      }
      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe("revokeScannerGrant", () => {
    test("revokes a grant on a managed campus", async () => {
      db.getRow.mockResolvedValue(grantRow());
      const result = await actions.revokeScannerGrant("g1");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("revoked");
      }
      expect(db.updateRow.mock.calls[0]?.[2]).toBe("g1");
      expect(db.updateRow.mock.calls[0]?.[3]).toHaveProperty("revoked_at");
      expect(auditActions()).toEqual(["member_pass_scanner.revoke"]);
    });

    test("refuses a campus admin for other-campus and all-campus grants", async () => {
      for (const campusId of ["2", null]) {
        db.getRow.mockResolvedValue(grantRow({ campus_id: campusId }));
        expect(await actions.revokeScannerGrant("g1")).toEqual({
          error: "forbidden_campus",
          success: false,
        });
      }
      expect(db.updateRow).not.toHaveBeenCalled();
    });

    test("lets a global admin revoke an all-campus grant", async () => {
      ctx = globalAdminCtx;
      db.getRow.mockResolvedValue(grantRow({ campus_id: null }));
      expect((await actions.revokeScannerGrant("g1")).success).toBe(true);
      expect(db.updateRow).toHaveBeenCalledTimes(1);
    });

    test("returns not_found for a missing grant", async () => {
      db.getRow.mockRejectedValue(new Error("missing"));
      expect(await actions.revokeScannerGrant("nope")).toEqual({
        error: "not_found",
        success: false,
      });
    });
  });

  describe("listScannerGrants", () => {
    test("scopes a campus admin to managed campuses", async () => {
      db.listRows.mockResolvedValue({
        rows: [
          grantRow(),
          grantRow({
            $id: "g2",
            expires_at: "2000-01-01T00:00:00.000Z",
            granted_by: "gone",
          }),
        ],
        total: 2,
      });
      users.get.mockImplementation(({ userId }) =>
        userId === "gone"
          ? Promise.reject(new Error("missing"))
          : Promise.resolve({ $id: userId, name: "Kari Leder" })
      );
      const result = await actions.listScannerGrants();
      const queries = (db.listRows.mock.calls[0]?.[2] as string[]).map(
        (query) => JSON.parse(query)
      );
      expect(queries).toContainEqual({
        attribute: "campus_id",
        method: "equal",
        values: ["1"],
      });
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.map((grant) => grant.status)).toEqual([
        "active",
        "expired",
      ]);
      expect(result.data[0]?.grantedBy).toBe("Kari Leder");
      expect(result.data[1]?.grantedBy).toBe("gone");
    });

    test("does not filter by campus for a global admin", async () => {
      ctx = globalAdminCtx;
      await actions.listScannerGrants();
      const queries = JSON.stringify(db.listRows.mock.calls[0]?.[2]);
      expect(queries).not.toContain("campus_id");
    });

    test("returns nothing for a campus admin without campuses", async () => {
      ctx = { ...campusAdminCtx, managedCampusIds: [] };
      expect(await actions.listScannerGrants()).toEqual({
        data: [],
        success: true,
      });
      expect(db.listRows).not.toHaveBeenCalled();
    });
  });
});
