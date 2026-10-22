import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

type Row = Record<string, unknown>;

const db = {
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
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

const {
  createBenefitPartner,
  deleteBenefitPartner,
  endBenefitPartner,
  listBenefitPartners,
  loadPartnersPage,
  restartBenefitPartner,
  updateBenefitPartner,
} = await import("./benefit-partners");

const editorCtx = (): UserAuthContext => makeCtx({ roles: ["benefitseditor"] });

beforeEach(() => {
  currentCtx = campusAdminOf("2");
  logAuditEvent.mockClear();
  db.listRows.mockReset();
  db.upsertRow.mockReset();
  db.getRow.mockReset();
  db.updateRow.mockReset();
  db.deleteRow.mockReset();
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

const partnerRow = (id: string, campusId: string, extra: Row = {}): Row => ({
  $id: id,
  campus_id: campusId,
  is_active: true,
  logo_url: null,
  name: `Partner ${id}`,
  ...extra,
});

const dealRow = (id: string, campusId: string, extra: Row = {}): Row => ({
  $id: id,
  campus_id: campusId,
  partner_id: "p2",
  publish_end: null,
  publish_start: null,
  section: "member",
  status: "published",
  title_en: "",
  title_nb: "Deal",
  ...extra,
});

/** Rows by table; getRow reads the partner rows. */
function seed(partners: Row[], deals: Row[]) {
  db.listRows.mockImplementation((_d: string, table: string) => {
    const rows = table === "benefit_partners" ? partners : deals;
    return Promise.resolve({ rows, total: rows.length });
  });
  db.getRow.mockImplementation((_d: string, table: string, rowId: string) => {
    const found = (table === "benefit_partners" ? partners : []).find(
      (row) => row.$id === rowId
    );
    return found
      ? Promise.resolve(found)
      : Promise.reject(Object.assign(new Error("missing"), { code: 404 }));
  });
  db.updateRow.mockImplementation(
    async (_d: string, _t: string, rowId: string, data: Row) => ({
      ...(partners.find((row) => row.$id === rowId) ?? {}),
      ...data,
    })
  );
}

const tablesOf = (fn: { mock: { calls: unknown[][] } }): unknown[] =>
  fn.mock.calls.map((call) => call[1]);

describe("loadPartnersPage", () => {
  test("returns visible partners with editable flags and their deals", async () => {
    seed([partnerRow("p2", "2"), partnerRow("p5", "5")], [dealRow("d1", "2")]);
    const page = await loadPartnersPage();
    expect(page.editableCampusIds).toEqual(["2"]);
    expect(page.visibleCampusIds).toEqual(["2", "5"]);
    expect(page.partners.map((p) => [p.id, p.editable])).toEqual([
      ["p2", true],
      ["p5", false],
    ]);
    expect(page.partners[0]?.deals.map((d) => d.$id)).toEqual(["d1"]);
    const partnerQueries = (db.listRows.mock.calls[0]?.[2] as string[]).map(
      (q) => JSON.parse(q)
    );
    expect(partnerQueries).toContainEqual(
      expect.objectContaining({ attribute: "campus_id", values: ["2", "5"] })
    );
  });
});

describe("updateBenefitPartner", () => {
  test("lets a campus admin rename a partner on their campus", async () => {
    seed([partnerRow("p2", "2")], []);
    const result = await updateBenefitPartner("p2", {
      campus_id: "2",
      name: " Nytt navn ",
    });
    expect(db.updateRow.mock.calls[0]?.[3]).toMatchObject({
      campus_id: "2",
      name: "Nytt navn",
    });
    expect(result).toMatchObject({ data: { id: "p2", name: "Nytt navn" } });
  });

  test("returns not found for a missing partner", async () => {
    seed([], []);
    expect(
      await updateBenefitPartner("nope", { campus_id: "2", name: "X" })
    ).toEqual({ error: "Partner not found" });
  });

  test("refuses a move to a campus the caller cannot write", async () => {
    seed([partnerRow("p2", "2")], []);
    expect(
      await updateBenefitPartner("p2", { campus_id: "5", name: "X" })
    ).toEqual({ error: "Unauthorized: no write access to this campus" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("refuses moving a partner away from its deals' campus", async () => {
    currentCtx = editorCtx();
    seed([partnerRow("p2", "2")], [dealRow("d1", "2")]);
    expect(
      await updateBenefitPartner("p2", { campus_id: "3", name: "X" })
    ).toEqual({ error: "This partner has offers on another campus" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("allows moving to Hele BISO", async () => {
    currentCtx = editorCtx();
    seed([partnerRow("p2", "2")], [dealRow("d1", "2")]);
    const result = await updateBenefitPartner("p2", {
      campus_id: "5",
      name: "X",
    });
    expect(result).toMatchObject({ data: { campus_id: "5" } });
  });

  test("validates the website", async () => {
    seed([partnerRow("p2", "2")], []);
    expect(
      await updateBenefitPartner("p2", {
        campus_id: "2",
        name: "X",
        website_url: "http://x",
      })
    ).toEqual({ error: "The website must start with https://" });
  });
});

describe("endBenefitPartner", () => {
  test("refuses a national partner for a campus admin", async () => {
    seed([partnerRow("p5", "5")], [dealRow("d1", "2", { partner_id: "p5" })]);
    expect(await endBenefitPartner("p5")).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("deactivates the partner without touching deals", async () => {
    currentCtx = editorCtx();
    seed(
      [partnerRow("p2", "2")],
      [dealRow("d1", "2"), dealRow("d2", "2", { status: "draft" })]
    );
    const result = await endBenefitPartner("p2");
    expect(result).toEqual({ data: { hiddenDeals: 1 } });
    expect(db.updateRow).toHaveBeenCalledTimes(1);
    expect(db.updateRow.mock.calls[0]?.[1]).toBe("benefit_partners");
    expect(db.updateRow.mock.calls[0]?.[3]).toEqual({ is_active: false });
    expect(tablesOf(db.updateRow)).not.toContain("campus_benefits");
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });
});

describe("restartBenefitPartner", () => {
  test("reactivates the partner without touching deals", async () => {
    seed([partnerRow("p2", "2", { is_active: false })], [dealRow("d1", "2")]);
    expect(await restartBenefitPartner("p2")).toEqual({ data: true });
    expect(db.updateRow.mock.calls[0]?.[3]).toEqual({ is_active: true });
    expect(tablesOf(db.updateRow)).not.toContain("campus_benefits");
  });
});

describe("deleteBenefitPartner", () => {
  test("refuses when a deal is on a campus the caller cannot write", async () => {
    seed([partnerRow("p2", "2")], [dealRow("d1", "2"), dealRow("d2", "3")]);
    expect(await deleteBenefitPartner("p2")).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(db.deleteRow).not.toHaveBeenCalled();
  });

  test("deletes codes, then deals, then the partner", async () => {
    currentCtx = editorCtx();
    seed([partnerRow("p2", "2")], [dealRow("d1", "2"), dealRow("d2", "3")]);
    db.deleteRow.mockImplementation((_d: string, table: string) =>
      table === "benefit_codes"
        ? Promise.reject(Object.assign(new Error("missing"), { code: 404 }))
        : Promise.resolve()
    );
    const result = await deleteBenefitPartner("p2");
    expect(result).toEqual({ data: { deletedDeals: 2 } });
    expect(db.deleteRow.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      ["benefit_codes", "d1"],
      ["campus_benefits", "d1"],
      ["benefit_codes", "d2"],
      ["campus_benefits", "d2"],
      ["benefit_partners", "p2"],
    ]);
    expect(logAuditEvent).toHaveBeenCalledTimes(1);
  });
});
