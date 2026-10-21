import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

type Row = Record<string, unknown>;

const db = {
  listRows: mock(),
  upsertRow: mock(),
};

function makeCtx(overrides: Partial<UserAuthContext> = {}): UserAuthContext {
  return {
    activeCampusId: undefined,
    campusNames: [],
    campusTeamIds: [],
    departmentNames: [],
    departmentTeamIds: [],
    email: null,
    managedCampuses: [],
    managedCampusIds: [],
    name: null,
    resolvedCampusIds: [],
    resolvedDepartmentIds: [],
    roles: [],
    userId: "user-1",
    ...overrides,
  };
}

const campusAdminOf = (campusId: string): UserAuthContext =>
  makeCtx({
    managedCampusIds: [campusId],
    resolvedCampusIds: [campusId],
    roles: ["campusadmin"],
  });

let currentCtx: UserAuthContext = campusAdminOf("2");
const logAuditEvent = mock(async () => undefined);

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({ logAuditEvent }));

const { createBenefitPartner, listBenefitPartners } = await import(
  "./benefit-partners"
);

beforeEach(() => {
  currentCtx = campusAdminOf("2");
  logAuditEvent.mockClear();
  db.listRows.mockReset();
  db.upsertRow.mockReset();
  db.listRows.mockResolvedValue({
    rows: [
      {
        $id: "p1",
        campus_id: "2",
        is_active: false,
        logo_url: null,
        name: "Kaffebar",
      },
    ],
    total: 1,
  });
  db.upsertRow.mockImplementation(
    async (_d: string, _t: string, rowId: string, data: Row) => ({
      $id: rowId,
      ...data,
    })
  );
});

describe("listBenefitPartners", () => {
  test("queries the campus and Hele BISO, name ascending", async () => {
    const partners = await listBenefitPartners("2");
    const queries = (db.listRows.mock.calls[0]?.[2] as string[]).map((q) =>
      JSON.parse(q)
    );
    expect(queries).toContainEqual(
      expect.objectContaining({
        attribute: "campus_id",
        method: "equal",
        values: ["2", "5"],
      })
    );
    expect(queries).toContainEqual(
      expect.objectContaining({ attribute: "name", method: "orderAsc" })
    );
    expect(partners).toEqual([
      {
        campus_id: "2",
        id: "p1",
        is_active: false,
        logo_url: null,
        name: "Kaffebar",
      },
    ]);
  });

  test("throws when the campus is not visible", async () => {
    currentCtx = campusAdminOf("3");
    await expect(listBenefitPartners("2")).rejects.toThrow(
      "Unauthorized: no access to this campus"
    );
  });
});

describe("createBenefitPartner", () => {
  test("refuses a campus the caller cannot write", async () => {
    expect(
      await createBenefitPartner({ campus_id: "5", name: "Kaffebar" })
    ).toEqual({ error: "Unauthorized: no write access to this campus" });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("returns an error for a non-https logo", async () => {
    expect(
      await createBenefitPartner({
        campus_id: "2",
        logo_url: "http://x/logo.png",
        name: "Kaffebar",
      })
    ).toEqual({ error: "The logo must be an https:// address" });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("returns an error for a blank name", async () => {
    expect(await createBenefitPartner({ campus_id: "2", name: "   " })).toEqual(
      { error: "Add the partner's name" }
    );
  });

  test("returns an error for a non-https website", async () => {
    expect(
      await createBenefitPartner({
        campus_id: "2",
        name: "Kaffebar",
        website_url: "http://x",
      })
    ).toEqual({ error: "The website must start with https://" });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("creates the partner with public read permission", async () => {
    const result = await createBenefitPartner({
      campus_id: "2",
      logo_url: "https://cdn.example/logo.png",
      name: "  Kaffebar ",
      website_url: "https://kaffebar.no",
    });
    const call = db.upsertRow.mock.calls[0] as unknown[];
    expect(call[1]).toBe("benefit_partners");
    expect(call[3]).toMatchObject({
      campus_id: "2",
      is_active: true,
      name: "Kaffebar",
      website_url: "https://kaffebar.no",
    });
    expect(call[4]).toEqual(['read("any")']);
    expect(result).toEqual({
      data: {
        campus_id: "2",
        id: call[2] as string,
        is_active: true,
        logo_url: "https://cdn.example/logo.png",
        name: "Kaffebar",
      },
    });
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });
});
