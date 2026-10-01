import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type { DocumentCreateFormValues } from "./schemas";

const db = {
  createRow: mock(),
  deleteRow: mock(),
  getRow: mock(),
  listRows: mock(),
  updateRow: mock(),
  upsertRow: mock(),
};

const sp = {
  createAnonymousViewLink: mock(),
  replaceFileInPlace: mock(),
  uploadNewFile: mock(),
};

const globalAdminCtx: UserAuthContext = {
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
  roles: ["globaladmin"],
  userId: "user-1",
};

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => globalAdminCtx),
}));
mock.module("@repo/connectors/sharepoint", () => ({
  getSharePointConfig: mock(() => ({})),
  SharePointService: class SharePointService {
    createAnonymousViewLink = sp.createAnonymousViewLink;
    replaceFileInPlace = sp.replaceFileInPlace;
    uploadNewFile = sp.uploadNewFile;
  },
}));
mock.module("next/cache", () => ({
  revalidatePath: mock(() => undefined),
}));
mock.module("./audit-log", () => ({
  logAuditEvent: mock(async () => undefined),
}));

process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID = "drive-1";

const {
  createDocument,
  deleteDocument,
  listDocumentVersions,
  uploadNewVersion,
} = await import("./documents");

const nationalValues: DocumentCreateFormValues = {
  campus_id: null,
  category: "national-statutes",
  department_id: null,
  description: null,
  language: "no",
  scope: "national",
  status: "draft",
  title: "Vedtekter for BISO",
  version: "13",
};

function pdfFormData(): FormData {
  const formData = new FormData();
  formData.append(
    "file",
    new File([new Uint8Array([1, 2, 3])], "upload.pdf", {
      type: "application/pdf",
    })
  );
  return formData;
}

const existingDoc = {
  $id: "doc-1",
  campus: null,
  campus_id: null,
  category: "national-statutes",
  department: null,
  language: "no",
  scope: "national",
  sharepoint_drive_id: "drive-1",
  sharepoint_item_id: "current-item",
  sharepoint_web_url: "https://sp.example/:b:/g/public",
  status: "published",
  title: "Vedtekter for BISO",
  version: "12",
  version_number: 12,
};

/** Routes listRows by table so each test states only the rows it needs. */
function mockTables(tables: Record<string, Record<string, unknown>[]>): void {
  db.listRows.mockImplementation((_databaseId: string, tableId: string) => {
    const rows = tables[tableId] ?? [];
    return { rows, total: rows.length };
  });
}

beforeEach(() => {
  for (const fn of [...Object.values(db), ...Object.values(sp)]) {
    fn.mockReset();
  }
  mockTables({});
  db.upsertRow.mockImplementation(async () => ({ $id: "doc-new" }));
  db.createRow.mockImplementation(async () => ({ $id: "ver-new" }));
  db.updateRow.mockImplementation(async () => ({ $id: "doc-1" }));
  db.deleteRow.mockImplementation(async () => undefined);
  sp.uploadNewFile.mockImplementation(
    async (driveId: string, _folder: string, name: string) => ({
      driveId,
      itemId: `item:${name}`,
      lastModified: "2026-10-01T00:00:00Z",
      name,
      size: 3,
      webUrl: `https://sp.example/${name}`,
    })
  );
  sp.replaceFileInPlace.mockImplementation(
    async (driveId: string, itemId: string) => ({
      driveId,
      itemId,
      lastModified: "2026-10-01T00:00:00Z",
      name: "Vedtekter for BISO.pdf",
      size: 3,
      webUrl: "https://sp.example/internal",
    })
  );
  sp.createAnonymousViewLink.mockResolvedValue(
    "https://sp.example/:b:/g/public"
  );
});

describe("createDocument", () => {
  test("archives the version, uploads the current file and stores both rows", async () => {
    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({ data: "doc-new", publicLink: true });
    expect(sp.uploadNewFile).toHaveBeenNthCalledWith(
      1,
      "drive-1",
      "/Organisational documents/Statutes/Norsk versjon/Previous versions",
      "Vedtekter for BISO v13.pdf",
      expect.anything()
    );
    expect(sp.uploadNewFile).toHaveBeenNthCalledWith(
      2,
      "drive-1",
      "/Organisational documents/Statutes/Norsk versjon",
      "Vedtekter for BISO.pdf",
      expect.anything()
    );
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "documents",
      "unique()",
      expect.objectContaining({
        sharepoint_item_id: "item:Vedtekter for BISO.pdf",
        sharepoint_web_url: "https://sp.example/:b:/g/public",
        version: "13",
        version_number: 13,
      })
    );
    const documentPayload = db.upsertRow.mock.calls[0]?.[3] as Record<
      string,
      unknown
    >;
    expect(documentPayload).not.toHaveProperty("sort_order");
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "document_versions",
      expect.any(String),
      expect.objectContaining({
        document_id: "doc-new",
        file_name: "Vedtekter for BISO v13.pdf",
        sharepoint_item_id: "item:Vedtekter for BISO v13.pdf",
        version_major: 13,
        version_minor: 0,
      })
    );
  });

  test("falls back to the internal URL when anonymous links are forbidden", async () => {
    sp.createAnonymousViewLink.mockRejectedValue(new Error("sharingDisabled"));

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({ data: "doc-new", publicLink: false });
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "documents",
      "unique()",
      expect.objectContaining({
        sharepoint_web_url: "https://sp.example/Vedtekter for BISO.pdf",
      })
    );
  });

  test("rejects an invalid version before touching SharePoint", async () => {
    const result = await createDocument(
      { ...nationalValues, version: "v13b" },
      pdfFormData()
    );

    expect(result).toEqual({
      error: "Invalid form data",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
  });

  test("refuses a second document that would share the same SharePoint file", async () => {
    mockTables({ documents: [existingDoc] });

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({
      error:
        "A document with this title already exists in this category. Open it and upload a new version instead.",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("refuses a title that sanitises to an existing file name", async () => {
    mockTables({ documents: [existingDoc] });

    const result = await createDocument(
      { ...nationalValues, title: "Vedtekter for BISO?" },
      pdfFormData()
    );

    expect(result).toEqual({
      error:
        "A document with this title already exists in this category. Open it and upload a new version instead.",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
  });

  test("allows the same title in another campus and uploads to that campus folder", async () => {
    mockTables({
      campus: [{ $id: "campus-bergen", name: "Bergen" }],
      documents: [
        { ...existingDoc, campus_id: "campus-oslo", scope: "campus" },
      ],
    });

    const result = await createDocument(
      {
        ...nationalValues,
        campus_id: "campus-bergen",
        category: "code-of-conduct",
        scope: "campus",
      },
      pdfFormData()
    );

    expect(result).toEqual({ data: "doc-new", publicLink: true });
    expect(sp.uploadNewFile).toHaveBeenNthCalledWith(
      2,
      "drive-1",
      "/Organisational documents/Code of Conduct/Bergen/Norsk versjon",
      "Vedtekter for BISO.pdf",
      expect.anything()
    );
  });

  test("rejects a campus document whose campus cannot be found", async () => {
    const result = await createDocument(
      { ...nationalValues, campus_id: "campus-gone", scope: "campus" },
      pdfFormData()
    );

    expect(result).toEqual({
      error: "Campus not found for this document",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("refuses a national document whose stray campus hides a collision", async () => {
    mockTables({ documents: [existingDoc] });

    const result = await createDocument(
      { ...nationalValues, campus_id: "campus-oslo" },
      pdfFormData()
    );

    expect(result).toEqual({
      error:
        "A document with this title already exists in this category. Open it and upload a new version instead.",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
  });

  test("drops a stray campus from a national document and uses the national folder", async () => {
    const result = await createDocument(
      { ...nationalValues, campus_id: "campus-oslo" },
      pdfFormData()
    );

    expect(result).toEqual({ data: "doc-new", publicLink: true });
    expect(sp.uploadNewFile).toHaveBeenNthCalledWith(
      2,
      "drive-1",
      "/Organisational documents/Statutes/Norsk versjon",
      "Vedtekter for BISO.pdf",
      expect.anything()
    );
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "documents",
      "unique()",
      expect.objectContaining({ campus: null, campus_id: null })
    );
  });

  test("refuses a national document when an existing national row has a stray campus", async () => {
    mockTables({
      documents: [{ ...existingDoc, campus_id: "campus-oslo" }],
    });

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({
      error:
        "A document with this title already exists in this category. Open it and upload a new version instead.",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
  });

  test("writes nothing to the database when SharePoint fails", async () => {
    sp.uploadNewFile.mockRejectedValue(new Error("403 Forbidden"));

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({
      error: "SharePoint upload failed: 403 Forbidden",
      sharePointError: true,
    });
    expect(db.upsertRow).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
  });
});

describe("uploadNewVersion", () => {
  test("archives the new version and replaces the current file in place", async () => {
    mockTables({
      document_versions: [
        {
          $id: "ver-12",
          document_id: "doc-1",
          version_major: 12,
          version_minor: 0,
        },
      ],
      documents: [existingDoc],
    });

    const result = await uploadNewVersion("doc-1", "13", pdfFormData());

    expect(result).toEqual({ data: "doc-1", version: "13" });
    expect(sp.uploadNewFile).toHaveBeenCalledWith(
      "drive-1",
      "/Organisational documents/Statutes/Norsk versjon/Previous versions",
      "Vedtekter for BISO v13.pdf",
      expect.anything()
    );
    expect(sp.replaceFileInPlace).toHaveBeenCalledWith(
      "drive-1",
      "current-item",
      expect.anything()
    );
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "documents",
      "doc-1",
      expect.objectContaining({ version: "13", version_number: 13 })
    );
    // The stored public link stays; the current item did not change.
    const payload = db.updateRow.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("sharepoint_web_url");
  });

  test.each([
    ["12", "the same version"],
    ["11.9", "a lower version"],
  ])("rejects %s (%s) before touching SharePoint", async (version) => {
    mockTables({
      document_versions: [
        {
          $id: "ver-12",
          document_id: "doc-1",
          version_major: 12,
          version_minor: 0,
        },
      ],
      documents: [existingDoc],
    });

    const result = await uploadNewVersion("doc-1", version, pdfFormData());

    expect(result).toEqual({
      error: "Version must be higher than the current v12",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
    expect(sp.replaceFileInPlace).not.toHaveBeenCalled();
  });

  test("uses the document's own version when no history rows exist yet", async () => {
    mockTables({ documents: [existingDoc] });

    const rejected = await uploadNewVersion("doc-1", "12", pdfFormData());
    expect(rejected).toEqual({
      error: "Version must be higher than the current v12",
      sharePointError: false,
    });

    const accepted = await uploadNewVersion("doc-1", "12.1", pdfFormData());
    expect(accepted).toEqual({ data: "doc-1", version: "12.1" });
  });

  test("rejects a malformed version", async () => {
    mockTables({ documents: [existingDoc] });

    const result = await uploadNewVersion("doc-1", "next", pdfFormData());

    expect(result).toEqual({
      error: "Version must be a number like 12 or 7.1",
      sharePointError: false,
    });
  });
});

describe("listDocumentVersions", () => {
  test("returns versions newest first", async () => {
    mockTables({
      document_versions: [
        { $id: "a", document_id: "doc-1", version_major: 7, version_minor: 1 },
        { $id: "b", document_id: "doc-1", version_major: 12, version_minor: 0 },
        { $id: "c", document_id: "doc-1", version_major: 7, version_minor: 10 },
      ],
      documents: [existingDoc],
    });

    const versions = await listDocumentVersions("doc-1");

    expect(versions.map((v) => v.$id)).toEqual(["b", "c", "a"]);
  });

  test("returns nothing for a document the caller cannot see", async () => {
    mockTables({});
    expect(await listDocumentVersions("missing")).toEqual([]);
  });
});

describe("deleteDocument", () => {
  test("removes the version rows along with the document", async () => {
    mockTables({
      document_versions: [
        {
          $id: "ver-11",
          document_id: "doc-1",
          version_major: 11,
          version_minor: 0,
        },
        {
          $id: "ver-12",
          document_id: "doc-1",
          version_major: 12,
          version_minor: 0,
        },
      ],
      documents: [existingDoc],
    });

    const result = await deleteDocument("doc-1");

    expect(result).toEqual({ data: true });
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "document_versions",
      "ver-11"
    );
    expect(db.deleteRow).toHaveBeenCalledWith(
      "app",
      "document_versions",
      "ver-12"
    );
    expect(db.deleteRow).toHaveBeenCalledWith("app", "documents", "doc-1");
  });
});
