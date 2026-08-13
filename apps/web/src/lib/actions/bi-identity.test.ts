import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
