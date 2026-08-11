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

const departmentCtx = makeCtx({
  campusNames: ["Oslo"],
  departmentNames: ["Sosialutvalget"],
  departmentTeamIds: ["sg-app-dept-sosialutvalget"],
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: ["dept-1"],
});
const campusAdminCtx = makeCtx({
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  resolvedCampusIds: ["campus-oslo"],
  roles: ["campusadmin"],
});
const globalAdminCtx = makeCtx({ roles: ["globaladmin"] });

let currentCtx: UserAuthContext = departmentCtx;

const departmentValues: BenefitFormValues = {
  campus_id: "campus-oslo",
  category: "Career",
  department_id: "dept-1",
  description_en: "",
  description_nb: "<p>Norsk beskrivelse</p>",
  image_url: null,
  is_featured: false,
  is_member_only: true,
  kind: "offer",
  partner_name: null,
  publish_end: null,
  publish_start: null,
  redemption_type: "none",
  redemption_value: null,
  sort_order: 0,
  status: "draft",
  teaser_en: null,
  teaser_nb: "Norsk ingress",
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
mock.module("@/lib/recruitment", () => ({
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map([["Oslo", "campus-oslo"]]),
    campusNamesById: new Map([["campus-oslo", "Oslo"]]),
    departmentIdsByName: new Map([["Sosialutvalget", "dept-1"]]),
    departmentNamesById: new Map([["dept-1", "Sosialutvalget"]]),
  })),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { createBenefit, getBenefit, updateBenefit } = await import("./benefits");

function mockBenefitRow(benefit: Record<string, unknown> | null): void {
  db.listRows.mockImplementation(
    async (_databaseId: string, tableId: string) => {
      if (tableId === "campus_benefits") {
        return { rows: benefit ? [benefit] : [], total: benefit ? 1 : 0 };
      }
      return { rows: [], total: 0 };
    }
  );
}

beforeEach(() => {
  currentCtx = departmentCtx;
  db.createRow.mockReset();
  db.deleteRow.mockReset();
  db.getRow.mockReset();
  db.listRows.mockReset();
  db.updateRow.mockReset();
  db.upsertRow.mockReset();

  db.getRow.mockImplementation(
    async (_databaseId: string, tableId: string, rowId: string) => {
      if (tableId === "departments") {
        return { $id: rowId, campus: { $id: "campus-oslo" } };
      }
      throw new Error(`Unexpected getRow for ${tableId}`);
    }
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

describe("benefit relationship persistence", () => {
  test("createBenefit persists ownership and the linked locale child", async () => {
    const result = await createBenefit(departmentValues);

    expect(result).toEqual({ data: expect.any(String) });
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "campus_benefits",
      expect.any(String),
      expect.objectContaining({
        campus: "campus-oslo",
        campus_id: "campus-oslo",
        // Inline bilingual columns remain the compatibility read path.
        description_nb: "<p>Norsk beskrivelse</p>",
        department: "dept-1",
        contentTranslations: [
          expect.objectContaining({
            $permissions: expect.any(Array),
            content_type: "memberBenefit",
            locale: "no",
            short_description: "Norsk ingress",
            title: "Norsk tittel",
          }),
        ],
      }),
      expect.any(Array)
    );
  });

  test("department author cannot clear their department", async () => {
    const result = await createBenefit({
      ...departmentValues,
      department_id: null,
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this department",
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("campus admin may keep a benefit campus-wide", async () => {
    currentCtx = campusAdminCtx;

    const result = await createBenefit({
      ...departmentValues,
      department_id: null,
    });

    expect(result).toEqual({ data: expect.any(String) });
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "campus_benefits",
      expect.any(String),
      expect.objectContaining({ campus: "campus-oslo", department: null }),
      expect.any(Array)
    );
  });

  test("no author may clear the campus", async () => {
    currentCtx = globalAdminCtx;

    const result = await createBenefit({
      ...departmentValues,
      campus_id: "",
      department_id: null,
    });

    expect(result).toEqual({
      error: expect.anything(),
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("updateBenefit authorizes the persisted relationship scope", async () => {
    mockBenefitRow({
      $id: "benefit-1",
      campus: { $id: "campus-bergen" },
      department: { $id: "dept-9" },
      status: "draft",
    });

    const result = await updateBenefit("benefit-1", departmentValues);

    expect(result).toEqual({ error: "Unauthorized: no access to this campus" });
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("updateBenefit reuses an existing locale child by id", async () => {
    db.listRows.mockImplementation(
      async (_databaseId: string, tableId: string) => {
        if (tableId === "campus_benefits") {
          return {
            rows: [
              {
                $id: "benefit-1",
                campus: { $id: "campus-oslo" },
                department: { $id: "dept-1" },
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
      }
    );

    await updateBenefit("benefit-1", departmentValues);

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

  test("getBenefit hides rows outside the relationship scope", async () => {
    mockBenefitRow({
      $id: "benefit-1",
      campus: { $id: "campus-bergen" },
      department: { $id: "dept-9" },
      status: "published",
    });

    await expect(getBenefit("benefit-1")).resolves.toBeNull();
  });
});
