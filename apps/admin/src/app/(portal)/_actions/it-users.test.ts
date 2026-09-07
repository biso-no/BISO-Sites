import { beforeEach, describe, expect, mock, test } from "bun:test";

const db = {
  createRow: mock(),
  listRows: mock(),
};

const graph = {
  addUserToGroup: mock(),
  createUser: mock(),
  findGroupByName: mock(),
  setManager: mock(),
};

const ctx = {
  email: "it@example.com",
  userId: "it-user",
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));

mock.module("@repo/connectors/azure/users", () => ({
  generateTemporaryPassword: mock(() => "Temporary1!Password"),
  generateUpn: mock(() => "ada.lovelace@biso.no"),
}));

mock.module("@/lib/it/graph", () => ({
  M365_DOMAIN: "biso.no",
  getGraphService: mock(() => graph),
  toListItem: mock((user: { displayName: string; id: string }) => ({
    accountEnabled: true,
    createdDateTime: null,
    department: null,
    displayName: user.displayName,
    id: user.id,
    jobTitle: null,
    lastNonInteractiveSignInDateTime: null,
    lastSignInDateTime: null,
    lastSuccessfulSignInDateTime: null,
    mail: null,
    officeLocation: null,
    userPrincipalName: "ada.lovelace@biso.no",
  })),
}));

mock.module("@/lib/it-permissions", () => ({
  requireItPermission: mock(async () => ctx),
}));

mock.module("@/lib/it/tenant-guard", () => ({
  getAllowedTenantUser: mock(),
}));

mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));

mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { createM365User } = await import("./it-users");

describe("createM365User", () => {
  beforeEach(() => {
    db.createRow.mockReset();
    db.listRows.mockReset();
    graph.addUserToGroup.mockReset();
    graph.createUser.mockReset();
    graph.findGroupByName.mockReset();
    graph.setManager.mockReset();

    db.listRows.mockImplementation((_databaseId: string, tableId: string) => {
      if (tableId === "campus") {
        return {
          rows: [{ $id: "1", name: "Oslo" }],
          total: 1,
        };
      }
      if (tableId === "departments") {
        return {
          rows: [
            {
              $id: "dept-operations",
              Name: "Operations Unit",
              active: true,
              campus_id: "1",
            },
          ],
          total: 1,
        };
      }
      return { rows: [], total: 0 };
    });
    db.createRow.mockResolvedValue({});
    graph.createUser.mockResolvedValue({
      accountEnabled: true,
      displayName: "Ada Lovelace",
      id: "graph-user-1",
      userPrincipalName: "ada.lovelace@biso.no",
    });
    graph.findGroupByName.mockImplementation(async (name: string) => ({
      displayName: name,
      id:
        name === "SG-App-Campus-Oslo"
          ? "group-campus-oslo"
          : "group-dept-operations",
    }));
    graph.addUserToGroup.mockResolvedValue(undefined);
  });

  test("assigns new M365 users to required campus and department security groups before success", async () => {
    const result = await createM365User({
      accountEnabled: true,
      campusId: "1",
      departmentId: "dept-operations",
      forceChangePasswordNextSignIn: true,
      givenName: "Ada",
      surname: "Lovelace",
      userPrincipalName: "ada.lovelace@biso.no",
    });

    expect(result.error).toBeUndefined();
    expect(graph.findGroupByName).toHaveBeenCalledWith("SG-App-Campus-Oslo");
    expect(graph.findGroupByName).toHaveBeenCalledWith(
      "SG-App-Dept-OperationsUnit"
    );
    expect(graph.addUserToGroup).toHaveBeenNthCalledWith(
      1,
      "graph-user-1",
      "group-campus-oslo"
    );
    expect(graph.addUserToGroup).toHaveBeenNthCalledWith(
      2,
      "graph-user-1",
      "group-dept-operations"
    );
    expect(db.createRow).toHaveBeenCalledWith("app", "user", "graph-user-1", {
      campus_id: "1",
      department_ids: ["dept-operations"],
      email: "ada.lovelace@biso.no",
      isActive: true,
      name: "Ada Lovelace",
    });
  });
});
