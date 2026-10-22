import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";
import type { BenefitFormValues } from "./schemas";

type Row = Record<string, unknown>;

interface ParsedQuery {
  attribute?: string;
  method: string;
  values?: unknown[];
}

const notFound = (): Error =>
  Object.assign(new Error("Row not found"), { code: 404 });

// In-memory tables. `equal`, `isNull` and `or` queries filter; ordering and
// limits are ignored, so the actions must not rely on the database to pick a
// row for them.
let benefitRows: Row[] = [];
let partnerRows: Row[] = [];
let translationRows: Row[] = [];
let codeRows = new Map<string, string>();

const TABLES: Record<string, () => Row[]> = {
  benefit_partners: () => partnerRows,
  campus_benefits: () => benefitRows,
  content_translations: () => translationRows,
};

const tableRows = (tableId: string): Row[] => TABLES[tableId]?.() ?? [];

const matchesQuery = (row: Row, query: ParsedQuery): boolean => {
  const value = row[query.attribute ?? ""];
  switch (query.method) {
    case "equal":
      return (query.values ?? []).includes(value);
    case "isNull":
      return value === null || value === undefined;
    case "or":
      return ((query.values ?? []) as ParsedQuery[]).some((nested) =>
        matchesQuery(row, nested)
      );
    default:
      return true;
  }
};

const matchesQueries = (row: Row, queries: string[] = []): boolean =>
  queries.every((query) => matchesQuery(row, JSON.parse(query) as ParsedQuery));

const db = {
  createRow: mock(),
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
const benefitsEditorCtx = makeCtx({
  email: "pr@biso.no",
  roles: ["benefitseditor"],
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
const notifyWebsite = mock(async (_tags: string[]) => undefined);
mock.module("@/lib/web-revalidate", () => ({ notifyWebsite }));

const {
  createBenefit,
  deleteBenefit,
  getBenefitForEdit,
  loadBenefitBoard,
  reorderBenefits,
  setBenefitStatus,
  updateBenefit,
} = await import("./benefits");

const memberValues: BenefitFormValues = {
  campus_id: "2",
  category: "food_drink",
  description_en: null,
  description_nb: "20 % på alt",
  image_url: null,
  is_featured: false,
  partner_id: null,
  publish_end: null,
  publish_start: null,
  redemption_type: "code",
  redemption_value: "BISO20",
  section: "member",
  status: "published",
  terms_en: null,
  terms_nb: null,
  title_en: "",
  title_nb: "Rabatt på kaffe",
};

function storedBenefit(overrides: Row = {}): Row {
  return {
    $createdAt: "2026-10-01T10:00:00.000Z",
    $id: "benefit-1",
    campus_id: "2",
    category: "food_drink",
    description_en: null,
    description_nb: "20 % på alt",
    image_url: null,
    is_featured: false,
    partner_id: null,
    publish_end: null,
    publish_start: null,
    redemption_type: "code",
    redemption_value: null,
    section: "member",
    sort_order: 2,
    status: "draft",
    terms_en: null,
    terms_nb: null,
    title_en: "Rabatt på kaffe",
    title_nb: "Rabatt på kaffe",
    ...overrides,
  };
}

function upsertCall(tableId: string): unknown[] | undefined {
  return db.upsertRow.mock.calls.find((call) => call[1] === tableId);
}

function updateCalls(tableId: string): unknown[][] {
  return db.updateRow.mock.calls.filter((call) => call[1] === tableId);
}

function listQueries(tableId: string): string[] {
  const call = db.listRows.mock.calls.find((entry) => entry[1] === tableId);
  return (call?.[2] ?? []) as string[];
}

beforeEach(() => {
  currentCtx = campusAdminOf("2");
  benefitRows = [];
  partnerRows = [];
  translationRows = [];
  codeRows = new Map();
  logAuditEvent.mockClear();
  notifyWebsite.mockClear();
  for (const fn of Object.values(db)) {
    fn.mockReset();
  }

  db.listRows.mockImplementation(
    (_databaseId: string, tableId: string, queries: string[]) => {
      const rows = tableRows(tableId).filter((row) =>
        matchesQueries(row, queries)
      );
      return Promise.resolve({ rows, total: rows.length });
    }
  );
  db.getRow.mockImplementation(
    (_databaseId: string, tableId: string, rowId: string) => {
      if (tableId === "benefit_codes") {
        const value = codeRows.get(rowId);
        return value === undefined
          ? Promise.reject(notFound())
          : Promise.resolve({ $id: rowId, benefit_id: rowId, value });
      }
      const row = tableRows(tableId).find((entry) => entry.$id === rowId);
      return row ? Promise.resolve(row) : Promise.reject(notFound());
    }
  );
  db.upsertRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Row
    ) => ({ $id: rowId, ...data })
  );
  db.updateRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Row
    ) => ({ $id: rowId, ...data })
  );
  db.deleteRow.mockImplementation(
    (_databaseId: string, tableId: string, rowId: string) =>
      tableId === "benefit_codes" && !codeRows.delete(rowId)
        ? Promise.reject(notFound())
        : Promise.resolve({})
  );
});

describe("createBenefit", () => {
  test("a campus admin of 2 publishes a member benefit with a private code", async () => {
    const result = await createBenefit(memberValues);

    expect(result).toEqual({ data: expect.any(String) });
    const benefitCall = upsertCall("campus_benefits");
    expect(benefitCall?.[3]).toEqual(
      expect.objectContaining({
        campus_id: "2",
        department: null,
        // Compatibility copy until every reader uses benefit_codes.
        redemption_value: "BISO20",
        section: "member",
      })
    );
    expect(benefitCall?.[4]).toEqual(['read("any")']);

    const codeCall = upsertCall("benefit_codes");
    expect(codeCall?.[2]).toBe(benefitCall?.[2]);
    expect(codeCall?.[3]).toEqual({
      benefit_id: benefitCall?.[2],
      updated_by: "user-1",
      value: "BISO20",
    });
    expect(codeCall?.[4]).toEqual([]);
    expect(notifyWebsite.mock.calls).toEqual([[["benefits"]]]);
  });

  test("a campus admin cannot create on Hele BISO", async () => {
    const result = await createBenefit({ ...memberValues, campus_id: "5" });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("a benefits editor can create on Hele BISO", async () => {
    currentCtx = benefitsEditorCtx;

    const result = await createBenefit({ ...memberValues, campus_id: "5" });

    expect(result).toEqual({ data: expect.any(String) });
    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({ campus_id: "5" })
    );
  });

  test("a new row goes after the highest sort order of its campus and section", async () => {
    benefitRows = [
      storedBenefit({ $id: "a", sort_order: 0 }),
      storedBenefit({ $id: "b", sort_order: 3 }),
      storedBenefit({ $id: "c", section: "career", sort_order: 9 }),
      storedBenefit({ $id: "d", campus_id: "3", sort_order: 7 }),
    ];

    await createBenefit(memberValues);

    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({ sort_order: 4 })
    );
  });

  test("legacy member rows without a section count for the sort order", async () => {
    benefitRows = [
      storedBenefit({ $id: "a", sort_order: 1 }),
      storedBenefit({ $id: "legacy", section: null, sort_order: 6 }),
    ];

    await createBenefit(memberValues);

    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({ sort_order: 7 })
    );
  });

  test("refuses a partner from another campus and allows a national one", async () => {
    partnerRows = [
      { $id: "bergen", campus_id: "3", logo_url: null, name: "Bergen bar" },
      { $id: "rekom", campus_id: "5", logo_url: null, name: "Rekom" },
    ];

    const foreign = await createBenefit({
      ...memberValues,
      partner_id: "bergen",
    });
    expect(foreign).toEqual({ error: "Partner not found" });
    expect(db.upsertRow).not.toHaveBeenCalled();

    const national = await createBenefit({
      ...memberValues,
      partner_id: "rekom",
    });
    expect(national).toEqual({ data: expect.any(String) });
    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({ partner_id: "rekom", partner_name: "Rekom" })
    );
  });

  test("snapshots the chosen partner and refuses a missing one", async () => {
    partnerRows = [
      {
        $id: "partner-1",
        campus_id: "2",
        is_active: true,
        logo_url: "https://cdn.example/logo.png",
        name: "Kaffebrenneriet",
      },
    ];

    await createBenefit({ ...memberValues, partner_id: "partner-1" });
    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({
        partner_id: "partner-1",
        partner_logo_url: "https://cdn.example/logo.png",
        partner_name: "Kaffebrenneriet",
      })
    );

    db.upsertRow.mockClear();
    const missing = await createBenefit({
      ...memberValues,
      partner_id: "partner-gone",
    });
    expect(missing).toEqual({ error: "Partner not found" });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });
});

describe("updateBenefit", () => {
  test("keeps a published benefit public", async () => {
    benefitRows = [storedBenefit({ status: "published" })];

    const result = await updateBenefit("benefit-1", memberValues);

    expect(result).toEqual({ data: "benefit-1" });
    expect(upsertCall("campus_benefits")?.[4]).toEqual(['read("any")']);
    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({ sort_order: 2 })
    );
    expect(notifyWebsite.mock.calls).toEqual([[["benefits"]]]);
  });

  test("a refused update does not notify the website", async () => {
    benefitRows = [storedBenefit({ campus_id: "3" })];

    const result = await updateBenefit("benefit-1", {
      ...memberValues,
      campus_id: "3",
    });

    expect("error" in result).toBe(true);
    expect(notifyWebsite).not.toHaveBeenCalled();
  });

  test("switching to no redemption deletes the code row and ignores a 404", async () => {
    benefitRows = [storedBenefit()];

    const result = await updateBenefit("benefit-1", {
      ...memberValues,
      redemption_type: "none",
      redemption_value: null,
    });

    expect(result).toEqual({ data: "benefit-1" });
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "benefit_codes",
      "benefit-1"
    );
    expect(upsertCall("benefit_codes")).toBeUndefined();
    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({ redemption_value: null })
    );
  });

  test("a campus admin of 2 cannot move a benefit to campus 3", async () => {
    benefitRows = [storedBenefit()];

    const result = await updateBenefit("benefit-1", {
      ...memberValues,
      campus_id: "3",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("refuses a partner from another campus", async () => {
    benefitRows = [storedBenefit()];
    partnerRows = [
      { $id: "bergen", campus_id: "3", logo_url: null, name: "Bergen bar" },
    ];

    const result = await updateBenefit("benefit-1", {
      ...memberValues,
      partner_id: "bergen",
    });

    expect(result).toEqual({ error: "Partner not found" });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("keeps a legacy free-text partner the website still reads", async () => {
    benefitRows = [
      storedBenefit({
        partner_id: null,
        partner_logo_url: "https://cdn.example/rekom.png",
        partner_name: "Rekom",
      }),
    ];

    const result = await updateBenefit("benefit-1", memberValues);

    expect(result).toEqual({ data: "benefit-1" });
    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({
        partner_id: null,
        partner_logo_url: "https://cdn.example/rekom.png",
        partner_name: "Rekom",
      })
    );
  });

  test("picking a real partner replaces the legacy free-text one", async () => {
    benefitRows = [storedBenefit({ partner_id: null, partner_name: "Rekom" })];
    partnerRows = [
      {
        $id: "partner-1",
        campus_id: "2",
        logo_url: null,
        name: "Kaffebrenneriet",
      },
    ];

    await updateBenefit("benefit-1", {
      ...memberValues,
      partner_id: "partner-1",
    });

    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({
        partner_id: "partner-1",
        partner_logo_url: null,
        partner_name: "Kaffebrenneriet",
      })
    );
  });

  test("clearing a linked partner clears its snapshot", async () => {
    benefitRows = [
      storedBenefit({
        partner_id: "partner-1",
        partner_name: "Kaffebrenneriet",
      }),
    ];

    await updateBenefit("benefit-1", memberValues);

    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({ partner_id: null, partner_name: null })
    );
  });

  test("moving to another section puts the row at the end of it", async () => {
    currentCtx = benefitsEditorCtx;
    benefitRows = [
      storedBenefit(),
      storedBenefit({ $id: "career-1", section: "career", sort_order: 5 }),
    ];

    await updateBenefit("benefit-1", { ...memberValues, section: "career" });

    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({ section: "career", sort_order: 6 })
    );
  });
});

describe("deleteBenefit", () => {
  test("removes the code row, then the benefit, and logs it", async () => {
    benefitRows = [storedBenefit()];
    codeRows.set("benefit-1", "BISO20");

    const result = await deleteBenefit("benefit-1");

    expect(result).toEqual({ data: "benefit-1" });
    expect(db.deleteRow.mock.calls).toEqual([
      ["app", "benefit_codes", "benefit-1"],
      ["app", "campus_benefits", "benefit-1"],
    ]);
    expect(logAuditEvent).toHaveBeenCalledWith(
      currentCtx,
      "benefit_deleted",
      expect.objectContaining({ resourceId: "benefit-1" })
    );
    expect(notifyWebsite.mock.calls).toEqual([[["benefits"]]]);
  });

  test("refuses a benefit on another campus", async () => {
    benefitRows = [storedBenefit({ campus_id: "3" })];

    const result = await deleteBenefit("benefit-1");
    expect(notifyWebsite).not.toHaveBeenCalled();

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(db.deleteRow).not.toHaveBeenCalled();
  });
});

describe("reorderBenefits", () => {
  beforeEach(() => {
    benefitRows = [
      storedBenefit({ $id: "a", sort_order: 0 }),
      storedBenefit({ $id: "b", sort_order: 1 }),
      storedBenefit({ $id: "c", sort_order: 2 }),
      storedBenefit({ $id: "career-1", section: "career", sort_order: 0 }),
    ];
  });

  test("writes only the sort orders that changed", async () => {
    const result = await reorderBenefits("2", "member", ["a", "c", "b"]);

    expect(result).toEqual({ data: true });
    expect(db.updateRow.mock.calls).toEqual([
      ["app", "campus_benefits", "c", { sort_order: 1 }],
      ["app", "campus_benefits", "b", { sort_order: 2 }],
    ]);
    expect(logAuditEvent).toHaveBeenCalledWith(
      currentCtx,
      "benefits_reordered",
      expect.anything()
    );
    expect(notifyWebsite.mock.calls).toEqual([[["benefits"]]]);
  });

  test("refuses an id from another section", async () => {
    const result = await reorderBenefits("2", "member", [
      "a",
      "b",
      "c",
      "career-1",
    ]);

    expect(result).toEqual({ error: "Reorder list is out of date" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("refuses a list that is missing a row", async () => {
    const result = await reorderBenefits("2", "member", ["c", "a"]);

    expect(result).toEqual({ error: "Reorder list is out of date" });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("includes legacy member rows without a section", async () => {
    benefitRows = [
      ...benefitRows,
      storedBenefit({ $id: "legacy", section: null, sort_order: 3 }),
    ];

    const result = await reorderBenefits("2", "member", [
      "legacy",
      "a",
      "b",
      "c",
    ]);

    expect(result).toEqual({ data: true });
    expect(db.updateRow.mock.calls).toEqual([
      ["app", "campus_benefits", "legacy", { sort_order: 0 }],
      ["app", "campus_benefits", "a", { sort_order: 1 }],
      ["app", "campus_benefits", "b", { sort_order: 2 }],
      ["app", "campus_benefits", "c", { sort_order: 3 }],
    ]);
  });

  test("a campus admin cannot reorder Hele BISO", async () => {
    benefitRows = [storedBenefit({ $id: "national", campus_id: "5" })];

    const result = await reorderBenefits("5", "member", ["national"]);

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});

describe("setBenefitStatus", () => {
  test("publishing a draft makes it public and keeps its code", async () => {
    benefitRows = [
      storedBenefit({ publish_start: "2026-11-01T23:00:00.000Z" }),
    ];
    codeRows.set("benefit-1", "BISO20");

    const result = await setBenefitStatus("benefit-1", "published");

    expect(result).toEqual({ data: "benefit-1" });
    expect(upsertCall("campus_benefits")?.[4]).toEqual(['read("any")']);
    expect(upsertCall("campus_benefits")?.[3]).toEqual(
      expect.objectContaining({
        publish_start: "2026-11-01T23:00:00.000Z",
        sort_order: 2,
        status: "published",
      })
    );
    expect(upsertCall("benefit_codes")?.[3]).toEqual(
      expect.objectContaining({ value: "BISO20" })
    );
  });

  for (const campusId of ["3", "5"]) {
    test(`a campus admin of 2 cannot change a benefit on campus ${campusId}`, async () => {
      benefitRows = [storedBenefit({ campus_id: campusId })];
      codeRows.set("benefit-1", "BISO20");

      const result = await setBenefitStatus("benefit-1", "published");

      expect(result).toEqual({
        error: "Unauthorized: no write access to this campus",
      });
      // Refused before the code row is even read.
      expect(db.getRow).not.toHaveBeenCalled();
      expect(db.upsertRow).not.toHaveBeenCalled();
      expect(db.deleteRow).not.toHaveBeenCalled();
    });
  }

  test("refuses a stored partner from another campus", async () => {
    benefitRows = [storedBenefit({ partner_id: "bergen" })];
    partnerRows = [
      { $id: "bergen", campus_id: "3", logo_url: null, name: "Bergen bar" },
    ];
    codeRows.set("benefit-1", "BISO20");

    const result = await setBenefitStatus("benefit-1", "published");

    expect(result).toEqual({ error: "Partner not found" });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("publishing still validates the stored row", async () => {
    benefitRows = [storedBenefit({ description_nb: "x".repeat(2001) })];
    codeRows.set("benefit-1", "BISO20");

    const result = await setBenefitStatus("benefit-1", "published");

    expect(result).toEqual({
      error: expect.objectContaining({ description_nb: expect.any(Array) }),
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("hiding writes only the status and private permissions", async () => {
    benefitRows = [storedBenefit({ status: "published" })];
    translationRows = [
      {
        $id: "tr-no",
        content_id: "benefit-1",
        content_type: "memberBenefit",
        locale: "no",
      },
      {
        $id: "tr-en",
        content_id: "benefit-1",
        content_type: "memberBenefit",
        locale: "en",
      },
      {
        $id: "tr-other",
        content_id: "benefit-2",
        content_type: "memberBenefit",
        locale: "no",
      },
    ];
    codeRows.set("benefit-1", "BISO20");

    const result = await setBenefitStatus("benefit-1", "archived");

    expect(result).toEqual({ data: "benefit-1" });
    expect(updateCalls("campus_benefits")).toEqual([
      ["app", "campus_benefits", "benefit-1", { status: "archived" }, []],
    ]);
    expect(
      updateCalls("content_translations").map((call) => [call[2], call[4]])
    ).toEqual([
      ["tr-no", []],
      ["tr-en", []],
    ]);
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.deleteRow).not.toHaveBeenCalled();
    expect(codeRows.get("benefit-1")).toBe("BISO20");
    expect(logAuditEvent).toHaveBeenCalledWith(
      currentCtx,
      "benefit_updated",
      expect.objectContaining({
        payload: expect.objectContaining({ status: "archived" }),
        resourceId: "benefit-1",
      })
    );
  });

  test("hiding works when the partner is now out of scope", async () => {
    benefitRows = [
      storedBenefit({ partner_id: "bergen", status: "published" }),
    ];
    partnerRows = [
      { $id: "bergen", campus_id: "3", logo_url: null, name: "Bergen bar" },
    ];
    codeRows.set("benefit-1", "BISO20");

    const result = await setBenefitStatus("benefit-1", "archived");

    expect(result).toEqual({ data: "benefit-1" });
    expect(updateCalls("campus_benefits")).toHaveLength(1);
  });

  test("hiding works with a stored description longer than the form allows", async () => {
    benefitRows = [
      storedBenefit({ description_nb: "x".repeat(2500), status: "published" }),
    ];
    codeRows.set("benefit-1", "BISO20");

    const result = await setBenefitStatus("benefit-1", "archived");

    expect(result).toEqual({ data: "benefit-1" });
    expect(updateCalls("campus_benefits")).toHaveLength(1);
  });

  test("hiding a legacy QR benefit leaves its code untouched", async () => {
    benefitRows = [
      storedBenefit({
        redemption_type: "qr",
        redemption_value: "QR-123",
        status: "published",
      }),
    ];
    codeRows.set("benefit-1", "QR-123");

    const result = await setBenefitStatus("benefit-1", "archived");

    expect(result).toEqual({ data: "benefit-1" });
    expect(updateCalls("campus_benefits")).toEqual([
      ["app", "campus_benefits", "benefit-1", { status: "archived" }, []],
    ]);
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.deleteRow).not.toHaveBeenCalled();
    expect(codeRows.get("benefit-1")).toBe("QR-123");
  });

  test("moving back to draft takes the same direct path", async () => {
    benefitRows = [storedBenefit({ status: "published" })];

    const result = await setBenefitStatus("benefit-1", "draft");

    expect(result).toEqual({ data: "benefit-1" });
    expect(updateCalls("campus_benefits")).toEqual([
      ["app", "campus_benefits", "benefit-1", { status: "draft" }, []],
    ]);
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("a campus admin of 2 cannot hide a benefit on campus 3", async () => {
    benefitRows = [storedBenefit({ campus_id: "3", status: "published" })];

    const result = await setBenefitStatus("benefit-1", "archived");

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(notifyWebsite).not.toHaveBeenCalled();
  });

  test("hiding a benefit notifies the website once", async () => {
    benefitRows = [storedBenefit({ status: "published" })];

    await setBenefitStatus("benefit-1", "archived");

    expect(notifyWebsite.mock.calls).toEqual([[["benefits"]]]);
  });

  test("an unknown status is refused before any read or write", async () => {
    benefitRows = [storedBenefit({ status: "published" })];

    const result = await setBenefitStatus(
      "benefit-1",
      "deleted" as unknown as "draft"
    );

    expect(result).toEqual({
      error: "That status is not allowed for a benefit",
    });
    expect(db.listRows).not.toHaveBeenCalled();
    expect(db.getRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(notifyWebsite).not.toHaveBeenCalled();
  });

  test("asks for the editor when a legacy QR benefit still has a value", async () => {
    benefitRows = [
      storedBenefit({ redemption_type: "qr", redemption_value: "QR-123" }),
    ];

    const result = await setBenefitStatus("benefit-1", "published");

    expect(result).toEqual({
      error:
        "This benefit uses an old redemption type. Open it in the editor and choose how students redeem it.",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.deleteRow).not.toHaveBeenCalled();
  });
});

describe("loadBenefitBoard", () => {
  beforeEach(() => {
    benefitRows = [
      storedBenefit({ $id: "oslo", redemption_value: "LEAK" }),
      storedBenefit({ $id: "bergen", campus_id: "3" }),
      storedBenefit({ $id: "national", campus_id: "5" }),
    ];
  });

  test("reads the campus and Hele BISO without codes", async () => {
    const board = await loadBenefitBoard("2");

    const queries = listQueries("campus_benefits");
    expect(queries).toContain(Query.equal("campus_id", ["2", "5"]));
    expect(queries).toContain(Query.limit(500));
    expect(board.benefits.map((benefit) => benefit.$id)).toEqual([
      "oslo",
      "national",
    ]);
    for (const benefit of board.benefits) {
      expect("redemption_value" in benefit).toBe(false);
    }
    expect(board.editable).toBe(true);
  });

  test("Hele BISO is read-only for a campus admin", async () => {
    const board = await loadBenefitBoard("5");

    expect(listQueries("campus_benefits")).toContain(
      Query.equal("campus_id", ["5"])
    );
    expect(board.editable).toBe(false);
  });

  test("a campus admin of 3 cannot open campus 2", async () => {
    currentCtx = campusAdminOf("3");

    await expect(loadBenefitBoard("2")).rejects.toThrow(
      "Unauthorized: no access to this campus"
    );
  });
});

describe("getBenefitForEdit", () => {
  test("returns the code from benefit_codes", async () => {
    benefitRows = [storedBenefit({ redemption_value: "OLD" })];
    codeRows.set("benefit-1", "BISO20");

    const benefit = await getBenefitForEdit("benefit-1");

    expect(benefit).toEqual(
      expect.objectContaining({
        $id: "benefit-1",
        editable: true,
        redemption_value: "BISO20",
      })
    );
  });

  test("falls back to the legacy value when no code row exists", async () => {
    benefitRows = [storedBenefit({ redemption_value: "OLD" })];

    const benefit = await getBenefitForEdit("benefit-1");

    expect(benefit?.redemption_value).toBe("OLD");
  });

  test("hides a benefit the caller cannot see", async () => {
    benefitRows = [storedBenefit({ campus_id: "3" })];

    await expect(getBenefitForEdit("benefit-1")).resolves.toBeNull();
  });

  test("a read-only viewer gets no code", async () => {
    benefitRows = [storedBenefit({ campus_id: "5", redemption_value: "OLD" })];
    codeRows.set("benefit-1", "BISO20");

    const benefit = await getBenefitForEdit("benefit-1");

    expect(benefit).toEqual(
      expect.objectContaining({ editable: false, redemption_value: null })
    );
  });

  test("a benefits editor gets the national code", async () => {
    currentCtx = benefitsEditorCtx;
    benefitRows = [storedBenefit({ campus_id: "5" })];
    codeRows.set("benefit-1", "BISO20");

    const benefit = await getBenefitForEdit("benefit-1");

    expect(benefit).toEqual(
      expect.objectContaining({ editable: true, redemption_value: "BISO20" })
    );
  });
});
