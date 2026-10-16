import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";

const db = { getRow: mock(), listRows: mock() };
const sendEmail = mock();
const isSmtpConfigured = mock(() => true);

const globalAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: [],
  campusTeamIds: [],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: [],
  managedCampusIds: [],
  name: "Global Admin",
  resolvedCampusIds: [],
  resolvedDepartmentIds: [],
  roles: ["globaladmin"],
  userId: "user-1",
};

let currentCtx: UserAuthContext = globalAdminCtx;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));

// `@repo/connectors/email` pulls in `server-only`, which throws outside a
// Server Component. Mock the module so the action under test still loads.
mock.module("@repo/connectors/email", () => ({ isSmtpConfigured, sendEmail }));

mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { listVarslingSettings, sendVarslingTestEmail } = await import(
  "./varsling"
);

describe("listVarslingSettings", () => {
  beforeEach(() => {
    currentCtx = globalAdminCtx;
    db.listRows.mockReset();
  });

  test("returns the true total and the requested slice", async () => {
    db.listRows.mockResolvedValueOnce({ rows: [{ $id: "v1" }], total: 87 });

    const result = await listVarslingSettings({ page: 2, size: 25, q: "" });

    expect(result.total).toBe(87);
    expect(result.page).toBe(2);
    const queries = db.listRows.mock.calls[0][2] as string[];
    expect(queries).toContain(Query.offset(25));
  });

  test("returns an empty page for an unauthorized user", async () => {
    currentCtx = {
      ...globalAdminCtx,
      departmentTeamIds: [],
      roles: ["campusadmin"],
    };

    const result = await listVarslingSettings({ page: 1, size: 25, q: "" });

    expect(result).toEqual({ rows: [], total: 0, page: 1, size: 25 });
    expect(db.listRows).not.toHaveBeenCalled();
  });
});

describe("sendVarslingTestEmail", () => {
  beforeEach(() => {
    currentCtx = globalAdminCtx;
    db.getRow.mockReset();
    sendEmail.mockReset();
    sendEmail.mockResolvedValue({
      accepted: ["hr@biso.no"],
      messageId: "<1@biso.no>",
      rejected: [],
    });
    isSmtpConfigured.mockReset();
    isSmtpConfigured.mockReturnValue(true);
  });

  test("mails the address stored on the row, not one supplied by the caller", async () => {
    db.getRow.mockResolvedValueOnce({
      $id: "v1",
      email: "hr@biso.no",
      role_name: "HR-sjef",
    });

    const result = await sendVarslingTestEmail("v1");

    expect(result).toEqual({ data: "hr@biso.no" });
    expect(sendEmail.mock.calls[0][0].to).toBe("hr@biso.no");
  });

  test("refuses an unauthorized user without reading or sending", async () => {
    currentCtx = {
      ...globalAdminCtx,
      departmentTeamIds: [],
      roles: ["campusadmin"],
    };

    const result = await sendVarslingTestEmail("v1");

    expect(result).toEqual({
      error: "Not authorized to manage varsling contacts",
    });
    expect(db.getRow).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("explains the misconfiguration when SMTP is unset", async () => {
    isSmtpConfigured.mockReturnValue(false);

    const result = await sendVarslingTestEmail("v1");

    expect("error" in result && result.error).toContain(
      "SMTP is not configured"
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("surfaces a relay failure instead of reporting success", async () => {
    db.getRow.mockResolvedValueOnce({
      $id: "v1",
      email: "hr@biso.no",
      role_name: "HR-sjef",
    });
    sendEmail.mockRejectedValueOnce(new Error("relay refused the message"));

    const result = await sendVarslingTestEmail("v1");

    expect(result).toEqual({ error: "relay refused the message" });
  });
});
