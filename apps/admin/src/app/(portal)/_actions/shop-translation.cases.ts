import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { ProductFormValues } from "./schemas";

let deferredCallback: (() => Promise<void> | void) | undefined;

const afterSpy = mock((callback: () => Promise<void> | void) => {
  deferredCallback = callback;
});
const generateObjectSpy = mock(async ({ prompt }: { prompt: string }) => ({
  object: {
    translations: prompt.includes("Norwegian Bokmål to English")
      ? [
          { key: "name", translated: "English product" },
          { key: "description", translated: "<p>English details</p>" },
        ]
      : [
          { key: "name", translated: "Norsk produkt" },
          { key: "description", translated: "<p>Norske detaljer</p>" },
        ],
  },
}));

const sessionDb = {
  createRow: mock(),
  deleteRow: mock(),
  listRows: mock(),
  updateRow: mock(),
};
const adminDb = {
  createRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};

const campusAdminCtx: UserAuthContext = {
  activeCampusId: undefined,
  campusNames: ["Oslo"],
  campusTeamIds: ["sg-app-campus-oslo"],
  departmentNames: [],
  departmentTeamIds: [],
  email: "admin@example.com",
  managedCampuses: ["Oslo"],
  managedCampusIds: ["campus-oslo"],
  name: "Oslo Admin",
  resolvedCampusIds: ["campus-oslo"],
  resolvedDepartmentIds: [],
  roles: ["campusadmin"],
  userId: "user-1",
};

const norwegianValues: ProductFormValues = {
  campus_id: "campus-oslo",
  category: "apparel",
  cover_pattern: "dotted",
  department_id: null,
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

mock.module("next/server", () => ({ after: afterSpy }));
mock.module("ai", () => ({ generateObject: generateObjectSpy }));
mock.module("@ai-sdk/openai", () => ({
  openai: mock((model: string) => model),
}));
mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db: adminDb })),
  createSessionClient: mock(async () => ({ db: sessionDb })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => campusAdminCtx),
}));
mock.module("@/lib/recruitment", () => ({
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map([["Oslo", "campus-oslo"]]),
    campusNamesById: new Map([["campus-oslo", "Oslo"]]),
    departmentIdsByName: new Map(),
    departmentNamesById: new Map(),
  })),
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

const { createProduct, generateProductTranslationDraft, updateProduct } =
  await import("./shop");

beforeEach(() => {
  deferredCallback = undefined;
  afterSpy.mockClear();
  generateObjectSpy.mockClear();
  sessionDb.createRow.mockReset();
  sessionDb.deleteRow.mockReset();
  sessionDb.listRows.mockReset();
  sessionDb.updateRow.mockReset();
  adminDb.createRow.mockReset();
  adminDb.getRow.mockReset();
  adminDb.listRows.mockReset();
  adminDb.updateRow.mockReset();
  adminDb.upsertRow.mockReset();

  sessionDb.createRow.mockImplementation(
    async (
      _databaseId: string,
      tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({
      $id: tableId === "webshop_products" ? "product-1" : rowId,
      ...data,
    })
  );
  sessionDb.updateRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  sessionDb.deleteRow.mockImplementation(async () => undefined);
  adminDb.createRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  adminDb.updateRow.mockImplementation(
    async (
      _databaseId: string,
      _tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({ $id: rowId, ...data })
  );
  adminDb.upsertRow.mockImplementation(
    async (
      _databaseId: string,
      tableId: string,
      rowId: string,
      data: Record<string, unknown>
    ) => ({
      $id: tableId === "webshop_products" ? "product-1" : rowId,
      ...data,
    })
  );
  adminDb.listRows.mockResolvedValue({ rows: [], total: 0 });
  adminDb.getRow.mockResolvedValue({
    campus_id: "campus-oslo",
    departmentId: null,
    member_only: false,
    status: "draft",
    translation_refs: [
      {
        $id: "translation-no",
        description: "<p>Norske detaljer</p>",
        locale: "no",
        title: "Norsk produkt",
      },
    ],
  });
});

describe("shop translation", () => {
  test("denies manual translation outside the editor's product scope", async () => {
    const result = await generateProductTranslationDraft({
      campusId: "campus-other",
      description: "<p>Source</p>",
      departmentId: null,
      name: "Source",
      sourceLocale: "en",
    });

    expect(result).toEqual({
      error: "Unauthorized: no write access to this campus",
    });
    expect(generateObjectSpy).not.toHaveBeenCalled();
  });

  test("generates a locale-aware manual draft in both directions", async () => {
    await expect(
      generateProductTranslationDraft({
        campusId: "campus-oslo",
        description: "<p>Norske detaljer</p>",
        departmentId: null,
        name: "Norsk produkt",
        sourceLocale: "no",
      })
    ).resolves.toEqual({
      data: {
        description: "<p>English details</p>",
        name: "English product",
      },
    });
    await expect(
      generateProductTranslationDraft({
        campusId: "campus-oslo",
        description: "<p>English details</p>",
        departmentId: null,
        name: "English product",
        sourceLocale: "en",
      })
    ).resolves.toEqual({
      data: {
        description: "<p>Norske detaljer</p>",
        name: "Norsk produkt",
      },
    });
  });

  test("keeps optional locale creation unchanged when auto-translation is disabled", async () => {
    await createProduct(norwegianValues, {
      enabled: false,
      sourceLocale: "no",
    });

    const parentCall = adminDb.upsertRow.mock.calls.find(
      (call) => call[1] === "webshop_products"
    );
    const children = (
      parentCall?.[3] as { translation_refs: Record<string, unknown>[] }
    ).translation_refs;
    expect(children).toHaveLength(1);
    expect(children[0]).toEqual(
      expect.objectContaining({ locale: "no", title: "Norsk produkt" })
    );
    expect(afterSpy).not.toHaveBeenCalled();
  });

  test("honors publish status when creating a product", async () => {
    await createProduct(
      { ...norwegianValues, status: "published" },
      { enabled: false, sourceLocale: "no" }
    );

    expect(adminDb.upsertRow).toHaveBeenCalledWith(
      "app",
      "webshop_products",
      expect.any(String),
      expect.objectContaining({ status: "published" }),
      expect.any(Array)
    );
  });

  test("does not queue an empty selected source locale", async () => {
    const result = await createProduct(norwegianValues, {
      enabled: true,
      sourceLocale: "en",
    });

    expect(result).toEqual({ data: "product-1" });
    expect(afterSpy).not.toHaveBeenCalled();
  });

  test("does not queue without a name in the selected source locale", async () => {
    const result = await createProduct(
      { ...norwegianValues, description_en: "English details" },
      { enabled: true, sourceLocale: "en" }
    );

    expect(result).toEqual({ data: "product-1" });
    expect(afterSpy).not.toHaveBeenCalled();
  });

  test("updates only the fresh English destination after persistence", async () => {
    adminDb.getRow.mockResolvedValue({
      campus_id: "campus-oslo",
      departmentId: null,
      member_only: false,
      status: "draft",
      translation_refs: [
        {
          $id: "translation-no",
          description: "<p>Norske detaljer</p>",
          locale: "no",
          title: "Norsk produkt",
        },
        {
          $id: "translation-en",
          description: "<p>Submitted English</p>",
          locale: "en",
          title: "Submitted English product",
        },
      ],
    });

    const result = await createProduct(
      {
        ...norwegianValues,
        description_en: "<p>Submitted English</p>",
        name_en: "Submitted English product",
      },
      {
        enabled: true,
        sourceLocale: "no",
      }
    );

    expect(result).toEqual({ data: "product-1", translationQueued: true });
    expect(afterSpy).toHaveBeenCalledTimes(1);
    expect(adminDb.updateRow).not.toHaveBeenCalled();
    await deferredCallback?.();

    expect(adminDb.updateRow).toHaveBeenCalledTimes(1);
    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "translation-en",
      {
        description: "<p>English details</p>",
        title: "English product",
      },
      expect.any(Array)
    );
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  test("replaces an untouched destination the form never carried", async () => {
    const oldEnglish = {
      $id: "translation-en",
      description: "Gamle engelske detaljer",
      locale: "en",
      title: "Gammelt engelsk produkt",
    };
    const norwegian = {
      $id: "translation-no",
      description: "<p>Norske detaljer</p>",
      locale: "no",
      title: "Norsk produkt",
    };
    adminDb.listRows.mockImplementation(
      async (_databaseId: string, tableId: string) =>
        tableId === "webshop_products"
          ? {
              rows: [
                {
                  $id: "product-1",
                  campus_id: "campus-oslo",
                  departmentId: null,
                  member_only: false,
                  status: "draft",
                },
              ],
              total: 1,
            }
          : { rows: [norwegian, oldEnglish], total: 2 }
    );
    adminDb.getRow.mockResolvedValue({
      campus_id: "campus-oslo",
      departmentId: null,
      member_only: false,
      status: "draft",
      translation_refs: [norwegian, oldEnglish],
    });

    await updateProduct("product-1", norwegianValues, {
      enabled: true,
      sourceLocale: "no",
    });
    await deferredCallback?.();

    // The save left the English row exactly as it found it, so the deferred
    // translation is still the newest writer for that locale.
    expect(adminDb.updateRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      "translation-en",
      {
        description: "<p>English details</p>",
        title: "English product",
      },
      expect.any(Array)
    );
  });

  test("skips a destination edited while the translation was running", async () => {
    adminDb.getRow.mockResolvedValue({
      campus_id: "campus-oslo",
      departmentId: null,
      member_only: false,
      status: "draft",
      translation_refs: [
        {
          $id: "translation-no",
          description: "<p>Norske detaljer</p>",
          locale: "no",
          title: "Norsk produkt",
        },
        {
          // Hand-written between scheduling and now — newer than this save.
          $id: "translation-en",
          description: "<p>Hand-written English</p>",
          locale: "en",
          title: "Hand-written English product",
        },
      ],
    });

    await createProduct(
      {
        ...norwegianValues,
        description_en: "<p>Submitted English</p>",
        name_en: "Submitted English product",
      },
      { enabled: true, sourceLocale: "no" }
    );
    await deferredCallback?.();

    expect(adminDb.updateRow).not.toHaveBeenCalled();
    expect(adminDb.createRow).not.toHaveBeenCalled();
  });

  test("updates only the fresh Norwegian destination from English", async () => {
    adminDb.getRow.mockResolvedValue({
      campus_id: "campus-oslo",
      departmentId: null,
      member_only: false,
      status: "draft",
      translation_refs: [
        {
          $id: "translation-en",
          description: "<p>English details</p>",
          locale: "en",
          title: "English product",
        },
      ],
    });

    await createProduct(
      {
        ...norwegianValues,
        description: "",
        description_en: "<p>English details</p>",
        name: "",
        name_en: "English product",
      },
      { enabled: true, sourceLocale: "en" }
    );
    expect(afterSpy).toHaveBeenCalledTimes(1);
    await deferredCallback?.();

    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      expect.any(String),
      expect.objectContaining({
        content_id: "product-1",
        content_type: "product",
        description: "<p>Norske detaljer</p>",
        locale: "no",
        product_ref: "product-1",
        title: "Norsk produkt",
      }),
      expect.any(Array)
    );
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("links a fresh destination locale to its product", async () => {
    const result = await createProduct(norwegianValues, {
      enabled: true,
      sourceLocale: "no",
    });

    expect(result).toEqual({ data: "product-1", translationQueued: true });
    await deferredCallback?.();

    expect(adminDb.createRow).toHaveBeenCalledWith(
      "app",
      "content_translations",
      expect.any(String),
      expect.objectContaining({
        content_id: "product-1",
        content_type: "product",
        description: "<p>English details</p>",
        locale: "en",
        product_ref: "product-1",
        title: "English product",
      }),
      expect.any(Array)
    );
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("skips a stale source snapshot", async () => {
    adminDb.getRow.mockResolvedValue({
      campus_id: "campus-oslo",
      departmentId: null,
      member_only: false,
      status: "draft",
      translation_refs: [
        {
          $id: "translation-no",
          description: "<p>Redigerte detaljer</p>",
          locale: "no",
          title: "Redigert produkt",
        },
      ],
    });

    await createProduct(norwegianValues, {
      enabled: true,
      sourceLocale: "no",
    });
    expect(afterSpy).toHaveBeenCalledTimes(1);
    await deferredCallback?.();

    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });

  test("skips translation when product visibility changes", async () => {
    adminDb.getRow.mockResolvedValueOnce({
      campus_id: "campus-oslo",
      departmentId: null,
      member_only: true,
      status: "draft",
    });

    await createProduct(norwegianValues, {
      enabled: true,
      sourceLocale: "no",
    });
    await deferredCallback?.();

    expect(adminDb.createRow).not.toHaveBeenCalled();
    expect(adminDb.updateRow).not.toHaveBeenCalled();
  });
});
