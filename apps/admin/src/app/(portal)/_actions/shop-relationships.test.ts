import { beforeEach, describe, expect, mock, test } from "bun:test";
import { Query } from "@repo/api";
import type { UserAuthContext } from "@/lib/authorization";
import type { ProductFormValues } from "./schemas";

const adminDb = {
  createRow: mock(),
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};
const sessionDb = {
  listRows: mock(),
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

let currentCtx: UserAuthContext = departmentCtx;

const departmentValues: ProductFormValues = {
  campus_id: "campus-oslo",
  category: "apparel",
  cover_pattern: "dotted",
  department_id: "dept-1",
  description: "<p>Norske detaljer</p>",
  description_en: "",
  finago_account_number: null,
  image: "",
  images: [],
  inventory_mode: "unlimited",
  linked_event_id: null,
  member_only: false,
  member_price: null,
  name: "Norsk produkt",
  name_en: "",
  regular_price: 100,
  short_description: null,
  slug: "norsk-produkt",
  status: "draft",
  stock: null,
  tags: [],
  variants_json: null,
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: sessionDb })),
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

const { createProduct, deleteProduct, getProduct, listOrders, updateProduct } =
  await import("./shop");

function mockProductRow(product: Record<string, unknown> | null): void {
  adminDb.listRows.mockImplementation(
    async (_databaseId: string, tableId: string) => {
      if (tableId === "webshop_products") {
        return { rows: product ? [product] : [], total: product ? 1 : 0 };
      }
      return { rows: [], total: 0 };
    }
  );
}

beforeEach(() => {
  currentCtx = departmentCtx;
  adminDb.createRow.mockReset();
  adminDb.deleteRow.mockReset();
  adminDb.getRow.mockReset();
  adminDb.listRows.mockReset();
  adminDb.updateRow.mockReset();
  adminDb.upsertRow.mockReset();
  sessionDb.listRows.mockReset();

  adminDb.getRow.mockImplementation(
    async (_databaseId: string, tableId: string, rowId: string) => {
      if (tableId === "departments") {
        return { $id: rowId, campus: { $id: "campus-oslo" } };
      }
      throw new Error(`Unexpected getRow for ${tableId}`);
    }
  );
  adminDb.upsertRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  adminDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  adminDb.deleteRow.mockImplementation(async () => undefined);
  sessionDb.listRows.mockResolvedValue({ rows: [], total: 0 });
});

describe("product relationship persistence", () => {
  test("createProduct persists ownership and the nested source locale", async () => {
    const result = await createProduct(departmentValues);

    expect(result).toEqual({ data: expect.any(String) });
    expect(adminDb.upsertRow).toHaveBeenCalledWith(
      "app",
      "webshop_products",
      expect.any(String),
      expect.objectContaining({
        campus: "campus-oslo",
        department: "dept-1",
        departmentId: "dept-1",
        translation_refs: expect.arrayContaining([
          expect.objectContaining({
            $permissions: expect.any(Array),
            content_type: "product",
            locale: "no",
            title: "Norsk produkt",
          }),
        ]),
      }),
      expect.any(Array)
    );
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  test("department author cannot create outside their department", async () => {
    const result = await createProduct({
      ...departmentValues,
      department_id: "dept-other",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this department",
    });
    expect(adminDb.upsertRow).not.toHaveBeenCalled();
  });

  test("updateProduct authorizes the persisted relationship scope", async () => {
    mockProductRow({
      $id: "product-1",
      campus: { $id: "campus-bergen" },
      department: { $id: "dept-9" },
      member_only: false,
      status: "draft",
    });

    const result = await updateProduct("product-1", departmentValues);

    expect(result).toEqual({ error: "Unauthorized: no access to this campus" });
    expect(adminDb.upsertRow).not.toHaveBeenCalled();
  });

  test("updateProduct keeps an untouched existing locale linked", async () => {
    currentCtx = campusAdminCtx;
    adminDb.listRows.mockImplementation(
      async (_databaseId: string, tableId: string) => {
        if (tableId === "webshop_products") {
          return {
            rows: [
              {
                $id: "product-1",
                campus: { $id: "campus-oslo" },
                department: { $id: "dept-1" },
                member_only: false,
                status: "draft",
              },
            ],
            total: 1,
          };
        }
        return {
          rows: [
            {
              $id: "translation-en",
              content_id: "product-1",
              locale: "en",
              title: "Old English",
            },
          ],
          total: 1,
        };
      }
    );

    await updateProduct("product-1", departmentValues);

    const call = adminDb.upsertRow.mock.calls.find(
      (candidate) => candidate[1] === "webshop_products"
    );
    const children = (
      call?.[3] as { translation_refs: Record<string, unknown>[] }
    ).translation_refs;
    expect(children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locale: "no", title: "Norsk produkt" }),
        { $id: "translation-en", $permissions: expect.any(Array) },
      ])
    );
  });

  test("getProduct hides rows outside the relationship scope", async () => {
    mockProductRow({
      $id: "product-1",
      campus: { $id: "campus-bergen" },
      department: { $id: "dept-9" },
      status: "published",
    });

    await expect(getProduct("product-1")).resolves.toBeNull();
  });

  test("deleteProduct refuses rows outside the relationship scope", async () => {
    mockProductRow({
      $id: "product-1",
      campus: { $id: "campus-bergen" },
      department: { $id: "dept-9" },
      status: "draft",
    });

    const result = await deleteProduct("product-1");

    expect(result).toEqual({ error: "Unauthorized: no access to this campus" });
    expect(adminDb.deleteRow).not.toHaveBeenCalled();
  });
});

describe("order operations stay narrow", () => {
  test("listOrders keeps its session-scoped operational authorization", async () => {
    currentCtx = campusAdminCtx;

    await listOrders();

    expect(sessionDb.listRows).toHaveBeenCalledWith(
      "app",
      "orders",
      expect.arrayContaining([Query.equal("campus_id", ["campus-oslo"])])
    );
    expect(adminDb.listRows).not.toHaveBeenCalled();
  });
});
