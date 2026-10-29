import { beforeEach, describe, expect, mock, test } from "bun:test";

const graph = {
  updateUser: mock(async () => ({})),
  revokeSignInSessions: mock(async () => ({})),
  resetPassword: mock(async () => ({})),
};
const getAllowedTenantUser = mock();

mock.module("server-only", () => ({}));
mock.module("next/cache", () => ({ revalidatePath: mock() }));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({
    db: {
      createRow: mock(async () => ({})),
      updateRow: mock(async () => ({})),
    },
  })),
}));
mock.module("@repo/connectors/azure/users", () => ({
  generateTemporaryPassword: () => "Temp-pass-1",
}));
mock.module("@/lib/it/graph", () => ({ getGraphService: () => graph }));
mock.module("@/lib/it/tenant-guard", () => ({ getAllowedTenantUser }));
mock.module("@/lib/it/turnover", () => ({
  buildTurnoverProfilePatch: (given: string, sur: string) => ({
    displayName: `${given} ${sur}`,
    givenName: given,
    surname: sur,
  }),
  computeRetentionStopAt: () => "2026-11-05T00:00:00.000Z",
  postRetentionWebhook: mock(async () => ({ ok: true })),
  RETENTION_RUN_DAYS: 7,
  resetUserMfaMethods: mock(async () => ({ failures: [] })),
}));
mock.module("@/lib/it-permissions", () => ({
  requireItPermission: mock(async () => ({ userId: "admin-1" })),
}));
mock.module("./audit-log", () => ({ logAuditEvent: mock(async () => ({})) }));

const BISO_DOMAIN_ERROR = /biso\.no/;

const { triggerM365Turnover } = await import("./it-turnover");

function userWith(upn: string) {
  return { id: "u1", displayName: "Someone", userPrincipalName: upn };
}

function input(upn: string) {
  return {
    userId: "u1",
    newFirstName: "Kari",
    newLastName: "Hansen",
    confirmationUpn: upn,
  };
}

describe("triggerM365Turnover", () => {
  beforeEach(() => {
    graph.updateUser.mockClear();
    graph.revokeSignInSessions.mockClear();
    graph.resetPassword.mockClear();
  });

  test("refuses a non-biso.no account before any Graph write", async () => {
    getAllowedTenantUser.mockImplementation(async () =>
      userWith("x@gmail.com")
    );
    const result = await triggerM365Turnover(input("x@gmail.com"));
    expect(result.error).toMatch(BISO_DOMAIN_ERROR);
    expect(graph.updateUser).not.toHaveBeenCalled();
    expect(graph.revokeSignInSessions).not.toHaveBeenCalled();
    expect(graph.resetPassword).not.toHaveBeenCalled();
  });

  test("proceeds for a biso.no account", async () => {
    getAllowedTenantUser.mockImplementation(async () =>
      userWith("leder.oslo@biso.no")
    );
    const result = await triggerM365Turnover(input("leder.oslo@biso.no"));
    expect(result.error).toBeUndefined();
    expect(graph.updateUser).toHaveBeenCalledTimes(1);
  });
});
