import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const db = {
  getRow: mock(),
  upsertRow: mock(),
};

const ctx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  name: "Admin",
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};

const logAuditEvent = mock(async () => undefined);
const fetchMock = mock();

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  getUserAuthContext: mock(async () => ctx),
}));
mock.module("next/cache", () => ({ revalidatePath: mock(() => undefined) }));
mock.module("../../_actions/audit-log", () => ({ logAuditEvent }));

globalThis.fetch = fetchMock as unknown as typeof fetch;

const { fetchAppStoreVersion, getAppVersionsView, saveAppVersionPolicy } =
  await import("./actions");

function rowNotFound(): Error {
  return Object.assign(new Error("Row with the requested ID not found."), {
    code: 404,
    type: "row_not_found",
  });
}

describe("app version actions", () => {
  beforeEach(() => {
    db.getRow.mockReset();
    db.upsertRow.mockReset();
    db.upsertRow.mockResolvedValue({});
    logAuditEvent.mockClear();
    fetchMock.mockReset();
    ctx.roles = ["globaladmin"];
  });

  test("saves a valid policy keyed by platform and audits it", async () => {
    const result = await saveAppVersionPolicy("ios", {
      minimum: "2.4.0",
      recommended: "",
    });
    expect(result).toEqual({ data: { minimum: "2.4.0", recommended: null } });
    expect(db.upsertRow).toHaveBeenCalledWith("app", "app_versions", "ios", {
      platform: "ios",
      minimum_version: "2.4.0",
      recommended_version: null,
    });
    expect(logAuditEvent).toHaveBeenCalledWith(
      ctx,
      "app_versions.update",
      expect.objectContaining({ resourceId: "ios" })
    );
  });

  test("refuses an invalid policy without writing", async () => {
    expect(
      await saveAppVersionPolicy("android", {
        minimum: "2.4.0",
        recommended: "2.3.0",
      })
    ).toEqual({ error: "recommendedBelowMinimum" });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("refuses non-global-admins", async () => {
    ctx.roles = ["campusadmin"];
    const result = await saveAppVersionPolicy("ios", {
      minimum: "2.4.0",
      recommended: "",
    });
    expect("error" in result && result.error).toContain("Forbidden");
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("reads the live App Store version", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ results: [{ version: "2.2.4" }] })
    );
    expect(await fetchAppStoreVersion()).toBe("2.2.4");
  });

  test("hides the App Store version when the lookup fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(await fetchAppStoreVersion()).toBeNull();
  });

  test("hides a malformed App Store version", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ results: [{ version: "2.2" }] })
    );
    expect(await fetchAppStoreVersion()).toBeNull();
  });

  test("treats a missing row as an empty policy", async () => {
    db.getRow.mockRejectedValue(rowNotFound());
    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await getAppVersionsView()).policies.android).toEqual({
      minimum: null,
      recommended: null,
    });
  });
});
