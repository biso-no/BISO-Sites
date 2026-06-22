import { createSessionClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAdminScope } from "./admin-auth";

vi.mock("server-only", () => ({}));
vi.mock("@repo/api/server", () => ({
  createAdminClient: vi.fn(),
  createSessionClient: vi.fn(),
}));

const mockedCreateSessionClient = vi.mocked(createSessionClient);

function requestWithJwt(): NextRequest {
  return {
    headers: new Headers({ authorization: "Bearer jwt-token" }),
  } as NextRequest;
}

function mockSessionClient({
  labels = [],
  teams = [],
  userId = "admin-user-1",
}: {
  labels?: string[];
  teams?: string[];
  userId?: string;
}): void {
  mockedCreateSessionClient.mockResolvedValue({
    account: {
      get: vi.fn().mockResolvedValue({ $id: userId, labels }),
    },
    teams: {
      list: vi.fn().mockResolvedValue({
        teams: teams.map((name) => ({ name })),
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createSessionClient>>);
}

describe("getAdminScope", () => {
  beforeEach(() => {
    mockedCreateSessionClient.mockReset();
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
      teams: ["SG-App-Campus-National", "SG-App-Dept-OperationsUnit"],
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
      teams: ["SG-App-Campus-Oslo", "SG-App-Dept-LedelsenOslo"],
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
});
