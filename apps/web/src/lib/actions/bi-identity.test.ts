import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const account = vi.hoisted(() => ({
  get: vi.fn(),
  listIdentities: vi.fn(),
}));

const db = vi.hoisted(() => ({
  createRow: vi.fn(),
  getRow: vi.fn(),
  updateRow: vi.fn(),
}));

const getBiDirectoryUser = vi.hoisted(() => vi.fn());

// A mutable flag the tests toggle to simulate Next's real behaviour: verified
// against the pinned next@16.3.0 in this repo
// (node_modules/next/dist/server/web/spec-extension/revalidate.js),
// `revalidateTag` throws unconditionally when called during a render-phase
// work unit. A bare `vi.fn()` spy (the previous version of this mock) erases
// that constraint entirely — this is what let C2 (revalidateTag called
// directly inside a render, its throw silently swallowed into a reported
// failure) ship undetected. See "does not report a successful link as a
// failure" below.
const renderPhase = vi.hoisted(() => ({ active: false }));
const revalidateTag = vi.hoisted(() =>
  vi.fn(() => {
    if (renderPhase.active) {
      throw new Error("Route revalidateTag used during render");
    }
  })
);

vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(async () => ({ db })),
  createSessionClient: vi.fn(async () => ({ account })),
}));

vi.mock("@repo/connectors/azure/bi-directory", () => ({
  getBiDirectoryUser,
}));

vi.mock("next/cache", () => ({
  revalidateTag,
}));

import { syncBiStudentIdentity } from "./bi-identity";

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
    revalidateTag.mockClear();
    renderPhase.active = false;

    account.get.mockResolvedValue({ $id: "user-1" });
    db.getRow.mockResolvedValue({});
    db.updateRow.mockResolvedValue({});
    db.createRow.mockResolvedValue({});
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
    expect(revalidateTag).toHaveBeenCalledWith("membership:1715738", {
      expire: 0,
    });
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
    expect(result).toEqual({ success: false, error: "directory_unavailable" });
  });

  it("does not report a successful link as a failure when cache invalidation throws mid-render (C2 regression guard)", async () => {
    account.listIdentities.mockResolvedValue({
      identities: [oidcIdentity("s1715738@bi.no")],
    });
    getBiDirectoryUser.mockResolvedValue({
      campusHint: "2",
      employeeId: "9001234",
    });
    renderPhase.active = true;

    const result = await syncBiStudentIdentity();

    // This is the regression C2 exists to catch: real Next.js throws
    // unconditionally from revalidateTag when called during a render phase,
    // and unstable_rethrow does not recognize that error, so a naive
    // implementation swallows it into the outer catch and reports a
    // successful write as `directory_unavailable`.
    expect(result).toEqual({
      success: true,
      studentId: "s1715738",
      hasEmployeeId: true,
      campusHint: "2",
    });
    // The write itself must still have gone through before the throw.
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "user",
      "user-1",
      expect.objectContaining({ student_id: "s1715738" })
    );
    expect(revalidateTag).toHaveBeenCalledWith("membership:1715738", {
      expire: 0,
    });
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
      expect(revalidateTag).toHaveBeenCalledWith("membership:1715738", {
        expire: 0,
      });
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

    it("is inert in production even when the variable is set", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("BI_DEV_STUDENT_EMAIL_OVERRIDE", `${STAFF_EMAIL}=s1715738`);
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
