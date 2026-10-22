import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { BenefitFormValues } from "./schemas";

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

const campusAdminCtx = makeCtx({
  campusNames: ["Oslo"],
  managedCampuses: ["Oslo"],
  managedCampusIds: ["2"],
  resolvedCampusIds: ["2"],
  roles: ["campusadmin"],
});
const globalAdminCtx = makeCtx({ roles: ["globaladmin"] });

let currentCtx: UserAuthContext = campusAdminCtx;

const campusValues: BenefitFormValues = {
  campus_id: "2",
  category: "food_drink",
  description_en: "",
  description_nb: "<p>Norsk beskrivelse</p>",
  image_url: null,
  is_featured: false,
  partner_id: null,
  publish_end: null,
  publish_start: null,
  redemption_type: "none",
  redemption_value: null,
  section: "member",
  status: "draft",
  terms_en: null,
  terms_nb: null,
  title_en: "",
  title_nb: "Norsk tittel",
};

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
mock.module("@/lib/web-revalidate", () => ({
  notifyWebsite: mock(async () => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { createBenefit, getBenefitForEdit, updateBenefit } = await import(
  "./benefits"
);

function mockBenefitRow(benefit: Record<string, unknown> | null): void {
  db.listRows.mockImplementation((_databaseId: string, tableId: string) => {
    if (tableId === "campus_benefits") {
      return { rows: benefit ? [benefit] : [], total: benefit ? 1 : 0 };
    }
    return { rows: [], total: 0 };
  });
}

beforeEach(() => {
  currentCtx = campusAdminCtx;
  db.createRow.mockReset();
  db.deleteRow.mockReset();
  db.getRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  db.upsertRow.mockReset();

  db.getRow.mockRejectedValue(
    Object.assign(new Error("Row not found"), { code: 404 })
  );
  db.deleteRow.mockRejectedValue(
    Object.assign(new Error("Row not found"), { code: 404 })
  );
  db.upsertRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  db.listRows.mockResolvedValue({ rows: [], total: 0 });
});

describe("benefit campus ownership", () => {
  test("createBenefit persists the campus, no department and the linked locale child", async () => {
    const result = await createBenefit(campusValues);

    expect(result).toEqual({ data: expect.any(String) });
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "campus_benefits",
      expect.any(String),
      expect.objectContaining({
        campus: "2",
        campus_id: "2",
        // Inline bilingual columns remain the compatibility read path.
        description_nb: "<p>Norsk beskrivelse</p>",
        department: null,
        contentTranslations: [
          {
            $permissions: [],
            additional_fields: null,
            content_id: expect.any(String),
            content_type: "memberBenefit",
            description: "<p>Norsk beskrivelse</p>",
            locale: "no",
            title: "Norsk tittel",
          },
        ],
      }),
      []
    );
  });

  test("published locale children are public", async () => {
    await createBenefit({ ...campusValues, status: "published" });

    const data = db.upsertRow.mock.calls[0]?.[3] as {
      contentTranslations: { $permissions: string[] }[];
    };
    expect(data.contentTranslations[0]?.$permissions).toEqual(['read("any")']);
  });

  test("no author may clear the campus", async () => {
    currentCtx = globalAdminCtx;

    const result = await createBenefit({
      ...campusValues,
      campus_id: "" as BenefitFormValues["campus_id"],
    });

    expect(result).toEqual({
      error: expect.anything(),
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("updateBenefit authorizes the stored campus", async () => {
    mockBenefitRow({
      $id: "benefit-1",
      campus_id: "3",
      section: "member",
      sort_order: 0,
      status: "draft",
    });

    const result = await updateBenefit("benefit-1", campusValues);

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("updateBenefit reuses an existing locale child by id", async () => {
    db.listRows.mockImplementation((_databaseId: string, tableId: string) => {
      if (tableId === "campus_benefits") {
        return {
          rows: [
            {
              $id: "benefit-1",
              campus_id: "2",
              section: "member",
              sort_order: 0,
              status: "draft",
            },
          ],
          total: 1,
        };
      }
      return {
        rows: [
          {
            $id: "translation-no",
            content_id: "benefit-1",
            locale: "no",
            title: "Gammel tittel",
          },
        ],
        total: 1,
      };
    });

    await updateBenefit("benefit-1", campusValues);

    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "campus_benefits",
      "benefit-1",
      expect.objectContaining({
        contentTranslations: [
          expect.objectContaining({
            $id: "translation-no",
            locale: "no",
            title: "Norsk tittel",
          }),
        ],
      }),
      expect.any(Array)
    );
  });

  test("getBenefitForEdit hides rows outside the caller's campuses", async () => {
    mockBenefitRow({
      $id: "benefit-1",
      campus_id: "3",
      section: "member",
      status: "published",
    });

    await expect(getBenefitForEdit("benefit-1")).resolves.toBeNull();
  });
});
