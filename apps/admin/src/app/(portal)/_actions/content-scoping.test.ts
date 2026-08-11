import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";

const db = {
  createRow: mock(),
  deleteRow: mock(),
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

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));

mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => campusAdminCtx),
}));

mock.module("@/lib/recruitment", () => ({
  loadRecruitmentLookups: mock(async () => ({
    campusIdsByName: new Map([
      ["Oslo", "campus-oslo"],
      ["Bergen", "campus-bergen"],
    ]),
    campusNamesById: new Map([
      ["campus-oslo", "Oslo"],
      ["campus-bergen", "Bergen"],
    ]),
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

mock.module("@repo/connectors/sharepoint", () => ({
  getSharePointConfig: mock(() => ({})),
  SharePointService: class SharePointService {},
}));

const { updateDocumentMetadata } = await import("./documents");
const { updateBenefit } = await import("./benefits");
const { updateNews } = await import("./news");
const { updateProduct } = await import("./shop");

const unauthorizedCampusError = "Unauthorized: no write access to this campus";

function mockExistingRows(rowsByTable: Record<string, unknown[]>): void {
  db.listRows.mockImplementation(
    async (_databaseId: string, tableId: string) => ({
      rows: rowsByTable[tableId] ?? [],
      total: rowsByTable[tableId]?.length ?? 0,
    })
  );
}

describe("admin content update scoping", () => {
  beforeEach(() => {
    db.createRow.mockReset();
    db.deleteRow.mockReset();
    db.getRow.mockReset();
    db.listRows.mockReset();
    db.updateRow.mockReset();
    db.upsertRow.mockReset();

    db.createRow.mockImplementation(
      async (
        _databaseId: string,
        _tableId: string,
        rowId: string,
        data: Record<string, unknown>
      ) => ({ $id: rowId, ...data })
    );
    db.updateRow.mockImplementation(
      async (
        _databaseId: string,
        _tableId: string,
        rowId: string,
        data: Record<string, unknown>
      ) => ({ $id: rowId, ...data })
    );
    db.upsertRow.mockImplementation(
      async (
        _databaseId: string,
        _tableId: string,
        rowId: string,
        data: Record<string, unknown>
      ) => ({ $id: rowId, ...data })
    );
  });

  test("news drafts cannot be moved to a campus the admin cannot write", async () => {
    mockExistingRows({
      content_translations: [],
      news: [
        {
          $id: "news-1",
          campus_id: "campus-oslo",
          department_id: null,
          status: "draft",
        },
      ],
    });

    const result = await updateNews("news-1", {
      author: null,
      campus_id: "campus-bergen",
      category: null,
      department_id: null,
      description_en: "",
      description_no: "Body",
      image: "",
      slug: "campus-news",
      status: "draft",
      sticky: false,
      title_en: "",
      title_no: "Campus news",
    });

    expect(result).toEqual({ error: unauthorizedCampusError });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("product drafts cannot be moved to a campus the admin cannot write", async () => {
    mockExistingRows({
      content_translations: [],
      webshop_products: [
        {
          $id: "product-1",
          campus_id: "campus-oslo",
          departmentId: null,
          status: "draft",
        },
      ],
    });

    const result = await updateProduct("product-1", {
      campus_id: "campus-bergen",
      category: null,
      cover_pattern: "dotted",
      department_id: null,
      description: "Description",
      description_en: null,
      finago_account_number: null,
      image: "",
      images: null,
      inventory_mode: "unlimited",
      linked_event_id: null,
      member_only: false,
      member_price: null,
      name: "Product",
      name_en: null,
      regular_price: 100,
      short_description: null,
      slug: "product",
      status: "draft",
      stock: null,
      tags: null,
      variants_json: null,
    });

    expect(result).toEqual({ error: unauthorizedCampusError });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("benefit drafts cannot be moved to a campus the admin cannot write", async () => {
    mockExistingRows({
      campus_benefits: [
        {
          $id: "benefit-1",
          campus_id: "campus-oslo",
          status: "draft",
        },
      ],
    });

    const result = await updateBenefit("benefit-1", {
      campus_id: "campus-bergen",
      category: "Food",
      description_en: "Description",
      description_nb: "Beskrivelse",
      image_url: "",
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
      teaser_nb: null,
      title_en: "Benefit",
      title_nb: "Fordel",
    });

    expect(result).toEqual({ error: unauthorizedCampusError });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("document drafts cannot be moved to a campus the admin cannot write", async () => {
    mockExistingRows({
      documents: [
        {
          $id: "document-1",
          campus_id: "campus-oslo",
          status: "draft",
        },
      ],
    });

    await expect(
      updateDocumentMetadata("document-1", {
        campus_id: "campus-bergen",
        category: "campus-bylaws",
        description: null,
        language: "no",
        scope: "campus",
        sort_order: 0,
        status: "draft",
        title: "Campus bylaws",
        version: null,
        version_number: 1,
      })
    ).rejects.toThrow(unauthorizedCampusError);
    expect(db.updateRow).not.toHaveBeenCalled();
  });
});
