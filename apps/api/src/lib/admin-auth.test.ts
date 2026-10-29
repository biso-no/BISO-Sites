import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canManageCampus, getAdminScope } from "./admin-auth";

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(),
  createSessionClient: vi.fn(),
}));

const mockedCreateSessionClient = vi.mocked(createSessionClient);
const mockedCreateAdminClient = vi.mocked(createAdminClient);
const getRow = vi.fn();

const notFound = () =>
  Object.assign(new Error("Row with the requested ID could not be found."), {
    code: 404,
  });

/** The caller's m365_team_sync record; `null` means there is none. */
function mockSyncRecord(teamIds: string[] | null): void {
  getRow.mockReset();
  if (teamIds === null) {
    getRow.mockRejectedValue(notFound());
  } else {
    getRow.mockResolvedValue({ $id: "admin-user-1", team_ids: teamIds });
  }
  mockedCreateAdminClient.mockResolvedValue({
    db: { getRow },
  } as unknown as Awaited<ReturnType<typeof createAdminClient>>);
}

function requestWithJwt(): NextRequest {
  return {
    headers: new Headers({ authorization: "Bearer jwt-token" }),
  } as NextRequest;
}

/**
 * By default the caller is a synced user: their record lists every team they
 * are in. Pass `record` to describe another record, or `null` for none.
 */
function mockSessionClient({
  labels = [],
  record,
  teams = [],
  userId = "admin-user-1",
}: {
  labels?: string[];
  record?: string[] | null;
  teams?: { $id: string; name: string }[];
  userId?: string;
}): void {
  mockSyncRecord(record === undefined ? teams.map((t) => t.$id) : record);
  mockedCreateSessionClient.mockResolvedValue({
    account: {
      get: vi.fn().mockResolvedValue({ $id: userId, labels }),
    },
    teams: {
      list: vi.fn().mockResolvedValue({
        teams,
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createSessionClient>>);
}

describe("getAdminScope", () => {
  beforeEach(() => {
    mockedCreateSessionClient.mockReset();
    mockedCreateAdminClient.mockReset();
  });

  it("does not grant global admin from Appwrite labels alone", async () => {
    mockSessionClient({
      labels: ["admin", "globaladmin"],
      teams: [],
    });

    const scope = await getAdminScope(requestWithJwt());

    expect(mockedCreateSessionClient).toHaveBeenCalledWith("jwt-token");
    expect(scope).toEqual({
      canManageAnyCampus: false,
      isCampusAdmin: false,
      isGlobalAdmin: false,
      managedCampusNames: [],
      managedDepartmentNames: [],
      userId: "admin-user-1",
    });
  });

  it("grants global admin from National and Operations Unit teams", async () => {
    mockSessionClient({
      teams: [
        { $id: "sg-app-campus-national", name: "National" },
        { $id: "sg-app-dept-operationsunit", name: "Operations Unit" },
      ],
    });

    const scope = await getAdminScope(requestWithJwt());

    expect(scope).toEqual({
      canManageAnyCampus: true,
      isCampusAdmin: false,
      isGlobalAdmin: true,
      managedCampusNames: [],
      managedDepartmentNames: [],
      userId: "admin-user-1",
    });
  });

  it("keeps campus admin derivation team-based", async () => {
    mockSessionClient({
      teams: [
        { $id: "sg-app-campus-oslo", name: "Oslo" },
        { $id: "sg-app-dept-ledelsenoslo", name: "Ledelsen Oslo" },
      ],
    });

    const scope = await getAdminScope(requestWithJwt());

    expect(scope).toEqual({
      canManageAnyCampus: false,
      isCampusAdmin: true,
      isGlobalAdmin: false,
      managedCampusNames: ["Oslo"],
      managedDepartmentNames: [],
      userId: "admin-user-1",
    });
  });

  it("gives a department member no campus scope", async () => {
    mockSessionClient({
      teams: [
        { $id: "sg-app-campus-oslo", name: "Oslo" },
        { $id: "sg-app-dept-marketing", name: "Marketing" },
      ],
    });

    const scope = await getAdminScope(requestWithJwt());

    expect(scope).toMatchObject({
      canManageAnyCampus: false,
      isCampusAdmin: false,
      managedCampusNames: [],
      managedDepartmentNames: ["Marketing"],
    });
    expect(scope && canManageCampus(scope, "Oslo")).toBe(false);
  });

  it("ignores user-created teams that copy admin names", async () => {
    mockSessionClient({
      teams: [
        { $id: "u1", name: "SG-App-Campus-National" },
        { $id: "u2", name: "SG-App-Dept-OperationsUnit" },
        { $id: "u3", name: "Operations Unit" },
        { $id: "u4", name: "National" },
      ],
    });

    const scope = await getAdminScope(requestWithJwt());

    expect(scope).toEqual({
      canManageAnyCampus: false,
      isCampusAdmin: false,
      isGlobalAdmin: false,
      managedCampusNames: [],
      managedDepartmentNames: [],
      userId: "admin-user-1",
    });
  });

  it("reads the caller's own sync record with the admin client", async () => {
    mockSessionClient({
      teams: [{ $id: "sg-app-campus-oslo", name: "Oslo" }],
    });

    await getAdminScope(requestWithJwt());

    expect(getRow).toHaveBeenCalledWith(
      "app",
      "m365_team_sync",
      "admin-user-1"
    );
  });

  it("does not grant global admin when the caller has no sync record", async () => {
    mockSessionClient({
      record: null,
      teams: [
        { $id: "sg-app-campus-national", name: "National" },
        { $id: "sg-app-dept-operationsunit", name: "Operations Unit" },
      ],
    });

    const scope = await getAdminScope(requestWithJwt());

    expect(scope).toEqual({
      canManageAnyCampus: false,
      isCampusAdmin: false,
      isGlobalAdmin: false,
      managedCampusNames: [],
      managedDepartmentNames: [],
      userId: "admin-user-1",
    });
  });

  it("grants global admin only when the record lists both teams", async () => {
    const teams = [
      { $id: "sg-app-campus-national", name: "National" },
      { $id: "sg-app-dept-operationsunit", name: "Operations Unit" },
    ];

    mockSessionClient({ teams, record: ["sg-app-campus-national"] });
    expect((await getAdminScope(requestWithJwt()))?.isGlobalAdmin).toBe(false);

    mockSessionClient({
      teams,
      record: ["sg-app-dept-operationsunit", "sg-app-campus-national"],
    });
    expect((await getAdminScope(requestWithJwt()))?.isGlobalAdmin).toBe(true);
  });

  it("drops a department team the record doesn't list", async () => {
    mockSessionClient({
      record: [],
      teams: [
        { $id: "sg-app-dept-marketing", name: "Marketing" },
        { $id: "biso-members", name: "BISO Members" },
      ],
    });

    const scope = await getAdminScope(requestWithJwt());

    expect(scope?.managedDepartmentNames).toEqual([]);
  });

  it("rethrows a failed sync record read", async () => {
    mockSessionClient({
      teams: [{ $id: "sg-app-campus-national", name: "National" }],
    });
    const outage = Object.assign(new Error("service unavailable"), {
      code: 503,
    });
    getRow.mockRejectedValue(outage);

    await expect(getAdminScope(requestWithJwt())).rejects.toBe(outage);
  });

  it("returns null when Appwrite rejects the session with 401", async () => {
    mockedCreateSessionClient.mockResolvedValue({
      account: {
        get: vi
          .fn()
          .mockRejectedValue(
            Object.assign(new Error("missing scope"), { code: 401 })
          ),
      },
      teams: { list: vi.fn() },
    } as unknown as Awaited<ReturnType<typeof createSessionClient>>);

    await expect(getAdminScope(requestWithJwt())).resolves.toBeNull();
  });

  it("rethrows non-auth Appwrite failures instead of masking them as 401", async () => {
    const outage = Object.assign(new Error("service unavailable"), {
      code: 503,
    });
    mockedCreateSessionClient.mockResolvedValue({
      account: { get: vi.fn().mockResolvedValue({ $id: "admin-user-1" }) },
      teams: { list: vi.fn().mockRejectedValue(outage) },
    } as unknown as Awaited<ReturnType<typeof createSessionClient>>);

    await expect(getAdminScope(requestWithJwt())).rejects.toBe(outage);
  });

  it("rethrows network errors without an HTTP code", async () => {
    const networkError = new TypeError("fetch failed");
    mockedCreateSessionClient.mockResolvedValue({
      account: { get: vi.fn().mockRejectedValue(networkError) },
      teams: { list: vi.fn() },
    } as unknown as Awaited<ReturnType<typeof createSessionClient>>);

    await expect(getAdminScope(requestWithJwt())).rejects.toBe(networkError);
  });
});
