import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({
  get: vi.fn(),
  listIdentities: vi.fn(),
}));

const db = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  listRows: vi.fn(),
  updateRow: vi.fn(),
}));

const users = vi.hoisted(() => ({
  deleteIdentity: vi.fn(),
  deleteSession: vi.fn(),
  get: vi.fn(),
  listIdentities: vi.fn(),
  listSessions: vi.fn(),
  updateEmailVerification: vi.fn(),
  updatePassword: vi.fn(),
}));

const getBiDirectoryUser = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db, users })),
  createSessionClient: vi.fn(async () => ({ account })),
}));

vi.mock("@repo/connectors/azure/bi-directory", () => ({
  getBiDirectoryUser,
}));

import {
  isFreshMergeIntoPasswordAccount,
  shouldMarkEmailVerified,
  syncBiStudentIdentityAfterSignIn,
} from "@repo/shared/utils/bi-identity-sync";
import { syncBiStudentIdentity } from "./bi-identity";

const ROTATED_PASSWORD_RE = /^[A-Za-z0-9_-]{40,}$/;

function oidcIdentity(providerEmail: string, providerUid = providerEmail) {
  return { $id: "identity-1", provider: "oidc", providerEmail, providerUid };
}

describe("syncBiStudentIdentity", () => {
  beforeEach(() => {
    account.get.mockReset();
    account.listIdentities.mockReset();
    db.createRow.mockReset();
    db.getRow.mockReset();
    db.updateRow.mockReset();
    getBiDirectoryUser.mockReset();

    account.get.mockResolvedValue({ $id: "user-1" });
    db.getRow.mockResolvedValue({});
    db.updateRow.mockResolvedValue({});
    db.createRow.mockResolvedValue({});
    db.listRows.mockReset();
    users.deleteIdentity.mockReset();
    users.get.mockReset();
    users.listIdentities.mockReset();
    users.updateEmailVerification.mockReset();
    users.updateEmailVerification.mockResolvedValue({});
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    users.deleteIdentity.mockResolvedValue({});
    users.listIdentities.mockResolvedValue({ identities: [] });
  });

  it("returns not_authenticated when there is no session, without writing anything", async () => {
    account.get.mockRejectedValue(new Error("no session"));

    const result = await syncBiStudentIdentity();

    expect(result).toEqual({ success: false, error: "not_authenticated" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("returns no_bi_identity when no linked identity is oidc, without writing anything", async () => {
    account.listIdentities.mockResolvedValue({
      identities: [
        {
          $id: "identity-0",
          provider: "email",
          providerEmail: "a@b.com",
          providerUid: "a@b.com",
        },
      ],
    });

    const result = await syncBiStudentIdentity();

    expect(result).toEqual({ success: false, error: "no_bi_identity" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("returns invalid_bi_email for a staff-shaped bi.no address, without writing anything", async () => {
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("ola.nordmann2@bi.no")],
    });

    const result = await syncBiStudentIdentity();

    expect(result).toEqual({ success: false, error: "invalid_bi_email" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("succeeds with an employee id and busts the matching membership cache tag", async () => {
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    getBiDirectoryUser.mockResolvedValue({
      campusHint: "2",
      displayName: "Ola Nordmann",
      employeeId: "9001234",
      givenName: "Ola",
      mail: "s1715738@bi.no",
      surname: "Nordmann",
    });

    const result = await syncBiStudentIdentity();

    expect(result).toEqual({
      success: true,
      studentId: "s1715738",
      hasEmployeeId: true,
      campusHint: "2",
    });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      expect.objectContaining({
        student_id: "s1715738",
        bi_employee_id: "9001234",
        bi_campus_id: "2",
        bi_linked_at: expect.any(String),
      })
    );
  });

  it("succeeds without an employee id on a genuine directory miss, and does not set bi_employee_id", async () => {
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    getBiDirectoryUser.mockResolvedValue(null);

    const result = await syncBiStudentIdentity();

    expect(result).toEqual({
      success: true,
      studentId: "s1715738",
      hasEmployeeId: false,
      campusHint: null,
    });
    expect(db.updateRow).toHaveBeenCalledTimes(1);
    const payload = db.updateRow.mock.calls[0]?.[3];
    expect(payload).toMatchObject({ student_id: "s1715738" });
    expect(payload).not.toHaveProperty("bi_employee_id");
    expect(payload).not.toHaveProperty("bi_campus_id");
  });

  it("still writes student_id when the directory lookup throws (Graph outage), and reports directory_unavailable", async () => {
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    getBiDirectoryUser.mockRejectedValue(new Error("Graph outage"));

    const result = await syncBiStudentIdentity();

    // This is the regression this test exists to catch: if the
    // getBiDirectoryUser() rejection were ever swallowed into a `null`
    // (e.g. `.catch(() => null)` added "for safety"), the code would take
    // the genuine-directory-miss path instead — `directoryFailed` would
    // stay false and this would resolve `{ success: true, hasEmployeeId:
    // false }`, silently reporting a Graph outage to the student as "your
    // record doesn't exist" instead of the honest `directory_unavailable`.
    expect(result).toEqual({ success: false, error: "directory_unavailable" });
    // student_id must still be written even though the directory call
    // failed — the write does not depend on the directory succeeding, so
    // linking survives the outage. (This assertion alone would not catch
    // the regression above: student_id is written on both the "genuine
    // miss" and "outage" paths. The `result` check above is what pins it.)
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      expect.objectContaining({ student_id: "s1715738" })
    );
    const payload = db.updateRow.mock.calls[0]?.[3];
    expect(payload).not.toHaveProperty("bi_employee_id");
    expect(payload).not.toHaveProperty("bi_campus_id");
  });

  it("does not overwrite an existing campus hint", async () => {
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    getBiDirectoryUser.mockResolvedValue({
      campusHint: "2",
      displayName: "Ola Nordmann",
      employeeId: null,
      givenName: "Ola",
      mail: "s1715738@bi.no",
      surname: "Nordmann",
    });
    db.getRow.mockResolvedValueOnce({ bi_campus_id: "1" });

    await syncBiStudentIdentity();

    const payload = db.updateRow.mock.calls[0]?.[3];
    expect(payload).not.toHaveProperty("bi_campus_id");
  });

  it("creates the profile row via the admin client when it doesn't exist yet (lazy creation during onboarding)", async () => {
    // The `user` profile row is only created at the FINAL onboarding wizard
    // step, while the BI-link step (this function) runs earlier — so a
    // brand-new user linking during onboarding hits this path every time.
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    getBiDirectoryUser.mockResolvedValue({
      campusHint: "2",
      displayName: "Ola Nordmann",
      employeeId: "9001234",
      givenName: "Ola",
      mail: "s1715738@bi.no",
      surname: "Nordmann",
    });
    // getRow for the pre-existing-campus-hint check also 404s for a
    // not-yet-created row; `.catch(() => null)` already handles that.
    db.getRow.mockRejectedValueOnce(
      Object.assign(new Error("not found"), {
        code: 404,
      })
    );
    db.updateRow.mockRejectedValueOnce(
      Object.assign(new Error("not found"), { code: 404 })
    );

    const result = await syncBiStudentIdentity();

    expect(result).toEqual({
      success: true,
      studentId: "s1715738",
      hasEmployeeId: true,
      campusHint: "2",
    });
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      expect.objectContaining({
        student_id: "s1715738",
        bi_employee_id: "9001234",
        bi_campus_id: "2",
        bi_linked_at: expect.any(String),
      }),
      expect.any(Array)
    );
  });

  it("rethrows a genuine update failure instead of falling through to create", async () => {
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    getBiDirectoryUser.mockResolvedValue({
      campusHint: null,
      employeeId: "9001234",
    });
    db.updateRow.mockRejectedValueOnce(new Error("network blip"));

    const result = await syncBiStudentIdentity();

    // A non-404 failure must not be treated as "row doesn't exist" — falling
    // through to create() here could conflict with a row that does exist.
    expect(db.createRow).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, error: "sync_failed" });
  });

  it("refuses a BI account already linked to another BISO account and removes the new identity", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    db.listRows.mockResolvedValue({
      rows: [{ $id: "user-2", student_id: "s1715738" }],
      total: 1,
    });
    users.listIdentities.mockResolvedValue({
      identities: [
        {
          $id: "identity-9",
          provider: "oidc",
          providerEmail: "s1715738@bi.no",
          providerUid: "s1715738@bi.no",
        },
      ],
    });

    const result = await syncBiStudentIdentity();

    expect(result).toEqual({ success: false, error: "already_linked" });
    expect(users.deleteIdentity).toHaveBeenCalledWith({
      identityId: "identity-1",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(getBiDirectoryUser).not.toHaveBeenCalled();
  });

  it("clears an unverified claim on another account and links the verified student", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    db.listRows.mockResolvedValue({
      rows: [{ $id: "user-2", student_id: "s1715738" }],
      total: 1,
    });
    getBiDirectoryUser.mockResolvedValue({
      campusHint: null,
      displayName: "Ola Nordmann",
      employeeId: "1015882",
      givenName: "Ola",
      mail: "s1715738@bi.no",
      surname: "Nordmann",
    });

    const result = await syncBiStudentIdentity();

    expect(result).toMatchObject({ success: true, studentId: "s1715738" });
    expect(db.updateRow).toHaveBeenCalledWith("app", "user", "user-2", {
      bi_campus_id: null,
      bi_employee_id: null,
      bi_linked_at: null,
      student_id: null,
    });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      expect.objectContaining({ student_id: "s1715738" })
    );
    expect(users.deleteIdentity).not.toHaveBeenCalled();
  });

  describe("BI_DEV_STUDENT_EMAIL_OVERRIDE", () => {
    // A staff address in BI's own tenant: same `bi.no` domain the student
    // format uses, so it clears the domain check and is rejected purely on the
    // local part. This is the real shape the override exists to unblock — a
    // BISO employee who has kept a BI staff account but lost their student one.
    const STAFF_EMAIL = "firstname.lastname@bi.no";

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("maps an allowlisted non-student address onto the configured student id", async () => {
      vi.stubEnv("BI_DEV_STUDENT_EMAIL_OVERRIDE", `${STAFF_EMAIL}=s1715738`);
      account.listIdentities.mockResolvedValue({
        identities: [oidcIdentity(STAFF_EMAIL)],
      });
      getBiDirectoryUser.mockResolvedValue({
        campusHint: "1",
        displayName: "Firstname Lastname",
        employeeId: "9007777",
        givenName: "Firstname",
        mail: STAFF_EMAIL,
        surname: "Lastname",
      });

      const result = await syncBiStudentIdentity();

      expect(result).toEqual({
        success: true,
        studentId: "s1715738",
        hasEmployeeId: true,
        campusHint: "1",
      });
      // The directory is queried under the address that actually resolves in
      // the tenant — the signed-in staff account — not the synthesized
      // `s1715738@bi.no`, whose mailbox is exactly what no longer exists.
      expect(getBiDirectoryUser).toHaveBeenCalledWith(STAFF_EMAIL);
      expect(db.updateRow).toHaveBeenCalledWith(
        "app",
        "user",
        "user-1",
        expect.objectContaining({
          student_id: "s1715738",
          bi_employee_id: "9007777",
          bi_campus_id: "1",
        })
      );
    });

    it("leaves the lookup key alone for a genuine student address", async () => {
      vi.stubEnv("BI_DEV_STUDENT_EMAIL_OVERRIDE", `${STAFF_EMAIL}=s1715738`);
      account.listIdentities.mockResolvedValue({
        identities: [oidcIdentity("s1715738@bi.no")],
      });
      getBiDirectoryUser.mockResolvedValue(null);

      await syncBiStudentIdentity();

      // A real student never touches the override path, so the lookup key
      // stays derived from the parsed id even with the variable set.
      expect(getBiDirectoryUser).toHaveBeenCalledWith("s1715738@bi.no");
    });

    it("accepts a bare student id on the right-hand side", async () => {
      vi.stubEnv("BI_DEV_STUDENT_EMAIL_OVERRIDE", `${STAFF_EMAIL}=s1715738`);
      account.listIdentities.mockResolvedValue({
        identities: [oidcIdentity(STAFF_EMAIL)],
      });
      getBiDirectoryUser.mockResolvedValue(null);

      await expect(syncBiStudentIdentity()).resolves.toMatchObject({
        success: true,
        studentId: "s1715738",
      });
    });

    it("matches on the account email when the identity carries a different UPN", async () => {
      vi.stubEnv("BI_DEV_STUDENT_EMAIL_OVERRIDE", `${STAFF_EMAIL}=s1715738`);
      account.get.mockResolvedValue({ $id: "user-1", email: STAFF_EMAIL });
      account.listIdentities.mockResolvedValue({
        identities: [oidcIdentity("some-upn@example.onmicrosoft.com")],
      });
      getBiDirectoryUser.mockResolvedValue(null);

      await expect(syncBiStudentIdentity()).resolves.toMatchObject({
        success: true,
        studentId: "s1715738",
      });
      // The lookup follows whichever candidate matched, not the UPN.
      expect(getBiDirectoryUser).toHaveBeenCalledWith(STAFF_EMAIL);
    });

    it("resolves the matching entry out of a comma-separated map", async () => {
      vi.stubEnv(
        "BI_DEV_STUDENT_EMAIL_OVERRIDE",
        `someone.else@bi.no=s2222222,${STAFF_EMAIL}=s1715738`
      );
      account.listIdentities.mockResolvedValue({
        identities: [oidcIdentity(STAFF_EMAIL)],
      });
      getBiDirectoryUser.mockResolvedValue(null);

      await expect(syncBiStudentIdentity()).resolves.toMatchObject({
        success: true,
        studentId: "s1715738",
      });
    });

    it("also maps an address from a different tenant entirely", async () => {
      vi.stubEnv(
        "BI_DEV_STUDENT_EMAIL_OVERRIDE",
        "firstname.lastname@biso.no=s1715738"
      );
      account.listIdentities.mockResolvedValue({
        identities: [oidcIdentity("firstname.lastname@biso.no")],
      });
      getBiDirectoryUser.mockResolvedValue(null);

      await expect(syncBiStudentIdentity()).resolves.toMatchObject({
        success: true,
        studentId: "s1715738",
      });
    });

    it("still applies in production, because the variable is the only gate", async () => {
      // Deliberate: linking cannot be exercised from localhost, so this has
      // to work against a real deployment. An unset variable is the entire
      // security boundary — which is what the next test pins.
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("BI_DEV_STUDENT_EMAIL_OVERRIDE", `${STAFF_EMAIL}=s1715738`);
      account.listIdentities.mockResolvedValue({
        identities: [oidcIdentity(STAFF_EMAIL)],
      });
      getBiDirectoryUser.mockResolvedValue(null);

      await expect(syncBiStudentIdentity()).resolves.toMatchObject({
        success: true,
        studentId: "s1715738",
      });
    });

    it("is inert when the variable is unset, in production or otherwise", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("BI_DEV_STUDENT_EMAIL_OVERRIDE", "");
      account.listIdentities.mockResolvedValue({
        identities: [oidcIdentity(STAFF_EMAIL)],
      });

      const result = await syncBiStudentIdentity();

      expect(result).toEqual({ success: false, error: "invalid_bi_email" });
      expect(db.updateRow).not.toHaveBeenCalled();
    });

    it("rejects an override whose target is not a valid student id", async () => {
      // A staff bi.no address on the right-hand side would fabricate a student
      // number if the mapped value were trusted verbatim.
      vi.stubEnv(
        "BI_DEV_STUDENT_EMAIL_OVERRIDE",
        `${STAFF_EMAIL}=ola.nordmann2@bi.no`
      );
      account.listIdentities.mockResolvedValue({
        identities: [oidcIdentity(STAFF_EMAIL)],
      });

      const result = await syncBiStudentIdentity();

      expect(result).toEqual({ success: false, error: "invalid_bi_email" });
      expect(db.updateRow).not.toHaveBeenCalled();
    });

    it("does not map an address that is absent from the allowlist", async () => {
      vi.stubEnv("BI_DEV_STUDENT_EMAIL_OVERRIDE", `${STAFF_EMAIL}=s1715738`);
      account.listIdentities.mockResolvedValue({
        identities: [oidcIdentity("someone.unlisted@bi.no")],
      });

      const result = await syncBiStudentIdentity();

      expect(result).toEqual({ success: false, error: "invalid_bi_email" });
      expect(db.updateRow).not.toHaveBeenCalled();
    });
  });
});

describe("syncBiStudentIdentityAfterSignIn", () => {
  beforeEach(() => {
    account.get.mockReset();
    account.listIdentities.mockReset();
    db.createRow.mockReset();
    db.getRow.mockReset();
    db.listRows.mockReset();
    db.updateRow.mockReset();
    getBiDirectoryUser.mockReset();
    users.deleteIdentity.mockReset();
    users.get.mockReset();
    users.listIdentities.mockReset();
    users.updateEmailVerification.mockReset();
    users.updateEmailVerification.mockResolvedValue({});

    db.getRow.mockResolvedValue({});
    db.updateRow.mockResolvedValue({});
    db.createRow.mockResolvedValue({});
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    users.get.mockResolvedValue({ $id: "user-1", email: "s1715738@bi.no" });
    users.deleteIdentity.mockResolvedValue({});
  });

  it("skips the directory and the write when the profile is already linked", async () => {
    users.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    db.getRow.mockResolvedValue({
      bi_campus_id: "1",
      bi_employee_id: "9001234",
      student_id: "s1715738",
    });

    const result = await syncBiStudentIdentityAfterSignIn("user-1");

    expect(result).toEqual({
      success: true,
      studentId: "s1715738",
      hasEmployeeId: true,
      campusHint: "1",
    });
    expect(getBiDirectoryUser).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  it("runs the full sync when the profile has the student number but no directory record", async () => {
    users.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    db.getRow.mockResolvedValue({ student_id: "s1715738" });
    getBiDirectoryUser.mockResolvedValue({
      campusHint: null,
      displayName: "Ola Nordmann",
      employeeId: "9001234",
      givenName: "Ola",
      mail: "s1715738@bi.no",
      surname: "Nordmann",
    });

    await syncBiStudentIdentityAfterSignIn("user-1");

    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      expect.objectContaining({ bi_employee_id: "9001234" })
    );
  });

  it("reads the account and its identities through the admin client, never the session", async () => {
    users.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    getBiDirectoryUser.mockResolvedValue({
      campusHint: null,
      displayName: "Ola Nordmann",
      employeeId: "9001234",
      givenName: "Ola",
      mail: "s1715738@bi.no",
      surname: "Nordmann",
    });

    const result = await syncBiStudentIdentityAfterSignIn("user-1");

    expect(result).toMatchObject({ success: true, studentId: "s1715738" });
    expect(account.get).not.toHaveBeenCalled();
    expect(account.listIdentities).not.toHaveBeenCalled();
    expect(users.get).toHaveBeenCalledWith("user-1");
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      expect.objectContaining({
        bi_employee_id: "9001234",
        student_id: "s1715738",
      })
    );
  });

  it("is a no-op for a sign-in without a BI identity", async () => {
    users.listIdentities.mockResolvedValue({
      identities: [
        {
          $id: "identity-0",
          provider: "magic-url",
          providerEmail: "a@b.com",
          providerUid: "a@b.com",
        },
      ],
    });

    const result = await syncBiStudentIdentityAfterSignIn("user-1");

    expect(result).toEqual({ success: false, error: "no_bi_identity" });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });

  it("reports not_authenticated when the account cannot be read", async () => {
    users.get.mockRejectedValue(new Error("gone"));
    users.listIdentities.mockResolvedValue({ identities: [] });

    const result = await syncBiStudentIdentityAfterSignIn("user-1");

    expect(result).toEqual({ success: false, error: "not_authenticated" });
  });
});

describe("isFreshMergeIntoPasswordAccount", () => {
  const now = new Date("2026-10-15T12:00:00Z");

  it("flags a minutes-old BI identity on an older account that has a password", () => {
    expect(
      isFreshMergeIntoPasswordAccount({
        identityCreatedAt: "2026-10-15T11:58:00Z",
        now,
        passwordUpdate: "2026-09-01T10:00:00Z",
        userCreatedAt: "2026-09-01T10:00:00Z",
      })
    ).toBe(true);
  });

  it("ignores an account without a password", () => {
    expect(
      isFreshMergeIntoPasswordAccount({
        identityCreatedAt: "2026-10-15T11:58:00Z",
        now,
        passwordUpdate: "",
        userCreatedAt: "2026-09-01T10:00:00Z",
      })
    ).toBe(false);
  });

  it("ignores an account created together with the identity", () => {
    expect(
      isFreshMergeIntoPasswordAccount({
        identityCreatedAt: "2026-10-15T11:58:00Z",
        now,
        passwordUpdate: "2026-10-15T11:58:00Z",
        userCreatedAt: "2026-10-15T11:57:50Z",
      })
    ).toBe(false);
  });

  it("ignores an identity that was attached long ago", () => {
    expect(
      isFreshMergeIntoPasswordAccount({
        identityCreatedAt: "2026-10-01T11:58:00Z",
        now,
        passwordUpdate: "2026-09-01T10:00:00Z",
        userCreatedAt: "2026-09-01T10:00:00Z",
      })
    ).toBe(false);
  });

  it("ignores unparsable dates", () => {
    expect(
      isFreshMergeIntoPasswordAccount({
        identityCreatedAt: "nope",
        now,
        passwordUpdate: "2026-09-01T10:00:00Z",
        userCreatedAt: "2026-09-01T10:00:00Z",
      })
    ).toBe(false);
  });
});

describe("syncBiStudentIdentityAfterSignIn takeover guard", () => {
  beforeEach(() => {
    db.getRow.mockReset();
    db.updateRow.mockReset();
    db.createRow.mockReset();
    db.listRows.mockReset();
    getBiDirectoryUser.mockReset();
    users.get.mockReset();
    users.listIdentities.mockReset();
    users.updateEmailVerification.mockReset();
    users.updateEmailVerification.mockResolvedValue({});
    users.listSessions.mockReset();
    users.deleteSession.mockReset();
    users.updatePassword.mockReset();

    db.getRow.mockResolvedValue({});
    db.updateRow.mockResolvedValue({});
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    getBiDirectoryUser.mockResolvedValue(null);
    users.listSessions.mockResolvedValue({
      sessions: [{ $id: "sess-old" }, { $id: "sess-now" }],
      total: 2,
    });
    users.deleteSession.mockResolvedValue({});
    users.updatePassword.mockResolvedValue({});
  });

  it("locks prior holders out of a password account the sign-in just merged into", async () => {
    users.get.mockResolvedValue({
      $createdAt: "2026-09-01T10:00:00Z",
      $id: "user-1",
      email: "s1715738@bi.no",
      passwordUpdate: "2026-09-01T10:00:00Z",
    });
    users.listIdentities.mockResolvedValue({
      identities: [
        {
          ...oidcIdentity("s1715738@bi.no"),
          $createdAt: new Date().toISOString(),
        },
      ],
    });

    const result = await syncBiStudentIdentityAfterSignIn("user-1", {
      currentSessionId: "sess-now",
    });

    expect(result).toMatchObject({ success: true, studentId: "s1715738" });
    expect(users.deleteSession).toHaveBeenCalledTimes(1);
    expect(users.deleteSession).toHaveBeenCalledWith({
      sessionId: "sess-old",
      userId: "user-1",
    });
    expect(users.updatePassword).toHaveBeenCalledWith({
      password: expect.stringMatching(ROTATED_PASSWORD_RE),
      userId: "user-1",
    });
  });

  it("leaves an ordinary student account alone", async () => {
    users.get.mockResolvedValue({
      $createdAt: new Date().toISOString(),
      $id: "user-1",
      email: "s1715738@bi.no",
      passwordUpdate: "",
    });
    users.listIdentities.mockResolvedValue({
      identities: [
        {
          ...oidcIdentity("s1715738@bi.no"),
          $createdAt: new Date().toISOString(),
        },
      ],
    });

    await syncBiStudentIdentityAfterSignIn("user-1", {
      currentSessionId: "sess-now",
    });

    expect(users.deleteSession).not.toHaveBeenCalled();
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it("does nothing without the current session id, which only the sign-in route has", async () => {
    users.get.mockResolvedValue({
      $createdAt: "2026-09-01T10:00:00Z",
      $id: "user-1",
      email: "s1715738@bi.no",
      passwordUpdate: "2026-09-01T10:00:00Z",
    });
    users.listIdentities.mockResolvedValue({
      identities: [
        {
          ...oidcIdentity("s1715738@bi.no"),
          $createdAt: new Date().toISOString(),
        },
      ],
    });

    await syncBiStudentIdentityAfterSignIn("user-1");

    expect(users.updatePassword).not.toHaveBeenCalled();
  });
});

describe("shouldMarkEmailVerified", () => {
  it("marks an unverified account whose email the BI identity carries", () => {
    expect(
      shouldMarkEmailVerified(
        { email: "S1715738@bi.no", emailVerification: false },
        { providerEmail: "s1715738@bi.no" }
      )
    ).toBe(true);
  });

  it("leaves a verified account, a different address or no address alone", () => {
    expect(
      shouldMarkEmailVerified(
        { email: "s1715738@bi.no", emailVerification: true },
        { providerEmail: "s1715738@bi.no" }
      )
    ).toBe(false);
    expect(
      shouldMarkEmailVerified(
        { email: "ola@gmail.com", emailVerification: false },
        { providerEmail: "s1715738@bi.no" }
      )
    ).toBe(false);
    expect(
      shouldMarkEmailVerified(
        { email: null, emailVerification: false },
        { providerEmail: "s1715738@bi.no" }
      )
    ).toBe(false);
  });
});

describe("syncBiStudentIdentityAfterSignIn email verification", () => {
  beforeEach(() => {
    db.getRow.mockReset();
    db.updateRow.mockReset();
    db.listRows.mockReset();
    getBiDirectoryUser.mockReset();
    users.get.mockReset();
    users.listIdentities.mockReset();
    users.updateEmailVerification.mockReset();
    users.updateEmailVerification.mockResolvedValue({});
    users.updateEmailVerification.mockReset();
    db.getRow.mockResolvedValue({});
    db.updateRow.mockResolvedValue({});
    db.listRows.mockResolvedValue({ rows: [], total: 0 });
    getBiDirectoryUser.mockResolvedValue(null);
    users.updateEmailVerification.mockResolvedValue({});
    users.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
  });

  it("marks the merged account's email verified", async () => {
    users.get.mockResolvedValue({
      $id: "user-1",
      email: "s1715738@bi.no",
      emailVerification: false,
    });

    await syncBiStudentIdentityAfterSignIn("user-1");

    expect(users.updateEmailVerification).toHaveBeenCalledWith({
      emailVerification: true,
      userId: "user-1",
    });
  });

  it("does nothing for an account that is already verified", async () => {
    users.get.mockResolvedValue({
      $id: "user-1",
      email: "s1715738@bi.no",
      emailVerification: true,
    });

    await syncBiStudentIdentityAfterSignIn("user-1");

    expect(users.updateEmailVerification).not.toHaveBeenCalled();
  });
});
