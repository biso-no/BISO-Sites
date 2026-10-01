import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import type { UserAuthContext } from "@/lib/authorization";
import type {
  DocumentCreateFormValues,
  DocumentMetadataFormValues,
} from "./schemas";

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

const bergenCampusAdminCtx: UserAuthContext = {
  ...globalAdminCtx,
  campusNames: ["Bergen"],
  campusTeamIds: ["sg-app-campus-bergen"],
  managedCampuses: ["Bergen"],
  managedCampusIds: ["campus-bergen"],
  resolvedCampusIds: ["campus-bergen"],
  roles: ["campusadmin"],
  userId: "user-bergen",
};

/** A control committee member based in Bergen: no admin role of their own. */
const controlCommitteeCtx: UserAuthContext = {
  ...globalAdminCtx,
  campusNames: ["Bergen"],
  campusTeamIds: ["sg-app-campus-bergen"],
  departmentNames: ["Control Committee"],
  departmentTeamIds: ["sg-app-dept-controlcommittee"],
  resolvedCampusIds: ["campus-bergen"],
  resolvedDepartmentIds: ["dept-control-committee"],
  roles: [],
  userId: "user-committee",
};

/** A member of another Bergen department: the broad department pseudo-role. */
const otherDepartmentCtx: UserAuthContext = {
  ...controlCommitteeCtx,
  departmentNames: ["Finance Committee"],
  departmentTeamIds: ["sg-app-dept-financecommittee"],
  resolvedDepartmentIds: ["dept-finance"],
  userId: "user-finance",
};

let currentCtx: UserAuthContext = globalAdminCtx;

mock.module("@repo/api/server", () => ({
  createAdminClient: mock(async () => ({ db })),
  createSessionClient: mock(async () => ({ db })),
}));
mock.module("@/lib/authorization", () => ({
  requireAuth: mock(async () => currentCtx),
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
const logAuditEvent = mock(async (..._args: unknown[]) => undefined);
mock.module("./audit-log", () => ({ logAuditEvent }));

process.env.SHAREPOINT_DOCUMENTS_DRIVE_ID = "drive-1";

const {
  createDocument,
  deleteDocument,
  listDepartmentsForDocument,
  listDocuments,
  listDocumentVersions,
  updateDocumentMetadata,
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

const existingMetadata: DocumentMetadataFormValues = {
  campus_id: null,
  category: "national-statutes",
  department_id: null,
  description: null,
  language: "no",
  scope: "national",
  status: "published",
  title: "Vedtekter for BISO",
};

/** An Oslo campus document, out of scope for the Bergen campus admin. */
const osloDoc = {
  ...existingDoc,
  campus: { $id: "campus-oslo" },
  campus_id: "campus-oslo",
  category: "campus-bylaws",
  scope: "campus",
};

const version12Row = {
  $id: "ver-12",
  document_id: "doc-1",
  version_major: 12,
  version_minor: 0,
};

// Appwrite rejects the literal "unique()" as a row id on upsert: at most 36
// chars of a-z, A-Z, 0-9 and underscore, not starting with an underscore.
const APPWRITE_ROW_ID = /^[a-zA-Z0-9][a-zA-Z0-9_]{0,35}$/;

const COLLISION_ERROR =
  "A document with this title already exists in this category. Open it and upload a new version instead.";
const PATH_LOCKED_ERROR =
  "The title, category, language, scope and campus decide where the file is stored in SharePoint and cannot be changed after upload. Create a new document instead.";

/** Silences and captures console.error for tests that expect a logged failure. */
function captureConsoleError() {
  return spyOn(console, "error").mockImplementation(() => undefined);
}

/** Routes listRows by table so each test states only the rows it needs. */
function mockTables(tables: Record<string, Record<string, unknown>[]>): void {
  db.listRows.mockImplementation((_databaseId: string, tableId: string) => {
    const rows = tables[tableId] ?? [];
    return { rows, total: rows.length };
  });
}

afterEach(() => {
  mock.restore();
});

beforeEach(() => {
  currentCtx = globalAdminCtx;
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
      expect.stringMatching(APPWRITE_ROW_ID),
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

  test("falls back to the internal URL and logs why when anonymous links are forbidden", async () => {
    const failure = new Error("sharingDisabled");
    sp.createAnonymousViewLink.mockRejectedValue(failure);
    const consoleError = captureConsoleError();

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({ data: "doc-new", publicLink: false });
    expect(consoleError).toHaveBeenCalledWith(
      "SharePoint public link could not be created:",
      failure
    );
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "documents",
      expect.stringMatching(APPWRITE_ROW_ID),
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
      expect.stringMatching(APPWRITE_ROW_ID),
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

  test("refuses a title that differs from an existing one only by letter case", async () => {
    mockTables({ documents: [existingDoc] });

    const result = await createDocument(
      { ...nationalValues, title: "VEDTEKTER for biso" },
      pdfFormData()
    );

    expect(result).toEqual({ error: COLLISION_ERROR, sharePointError: false });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("refuses a Norwegian document that collides with a row stored without a language", async () => {
    mockTables({ documents: [{ ...existingDoc, language: null }] });

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({ error: COLLISION_ERROR, sharePointError: false });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
    // The candidate query must not filter by language, or that row is never read.
    const collisionQueries = db.listRows.mock.calls
      .filter((call) => call[1] === "documents")
      .flatMap((call) => call[2] as string[]);
    expect(collisionQueries.some((query) => query.includes("language"))).toBe(
      false
    );
  });

  test.each([
    "authorization-matrix",
    "target-documents",
  ] as const)("rejects the %s category before touching SharePoint", async (category) => {
    const result = await createDocument(
      { ...nationalValues, category },
      pdfFormData()
    );

    expect(result).toEqual({
      error:
        "This category is not enabled in the database yet. Ask IT to add it to the documents table.",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
    expect(sp.createAnonymousViewLink).not.toHaveBeenCalled();
    expect(db.upsertRow).not.toHaveBeenCalled();
  });

  test("reports a failed documents insert instead of throwing", async () => {
    db.upsertRow.mockRejectedValue(new Error("Invalid document structure"));

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({
      error:
        "Saved to SharePoint but the database write failed: Invalid document structure. Try again.",
      sharePointError: false,
    });
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.deleteRow).not.toHaveBeenCalled();
  });

  test("removes the documents row when the version row cannot be written", async () => {
    db.createRow.mockRejectedValue(new Error("Table not found"));

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({
      error:
        "Saved to SharePoint but the database write failed: Table not found. Try again.",
      sharePointError: false,
    });
    expect(db.deleteRow).toHaveBeenCalledTimes(1);
    expect(db.deleteRow).toHaveBeenCalledWith("app", "documents", "doc-new");
  });

  test("still reports the version-row failure when the cleanup delete fails too", async () => {
    db.createRow.mockRejectedValue(new Error("Table not found"));
    db.deleteRow.mockRejectedValue(new Error("delete failed"));

    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({
      error:
        "Saved to SharePoint but the database write failed: Table not found. Try again.",
      sharePointError: false,
    });
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

describe("updateDocumentMetadata", () => {
  test.each([
    ["a different title", { title: "Vedtekter for BISO 2026" }],
    ["another category", { category: "code-of-conduct" }],
    ["another language", { language: "en" }],
    ["a campus scope", { campus_id: "campus-oslo", scope: "campus" }],
  ] as const)("rejects %s because it would change the SharePoint path", async (_label, change) => {
    mockTables({
      campus: [{ $id: "campus-oslo", name: "Oslo" }],
      documents: [existingDoc],
    });

    const result = await updateDocumentMetadata("doc-1", {
      ...existingMetadata,
      ...change,
    });

    expect(result).toEqual({ error: PATH_LOCKED_ERROR });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("rejects moving a campus document to another campus", async () => {
    mockTables({ documents: [osloDoc] });

    const result = await updateDocumentMetadata("doc-1", {
      ...existingMetadata,
      campus_id: "campus-bergen",
      category: "campus-bylaws",
      scope: "campus",
    });

    expect(result).toEqual({ error: PATH_LOCKED_ERROR });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("saves a description and status edit", async () => {
    mockTables({ documents: [existingDoc] });

    const result = await updateDocumentMetadata("doc-1", {
      ...existingMetadata,
      description: "Adopted by the national assembly",
      status: "draft",
    });

    expect(result).toEqual({ data: "doc-1" });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "documents",
      "doc-1",
      expect.objectContaining({
        description: "Adopted by the national assembly",
        status: "draft",
        title: "Vedtekter for BISO",
      })
    );
  });

  test("saves a title edit that only changes letter case", async () => {
    mockTables({ documents: [existingDoc] });

    const result = await updateDocumentMetadata("doc-1", {
      ...existingMetadata,
      title: "Vedtekter for Biso",
    });

    expect(result).toEqual({ data: "doc-1" });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "documents",
      "doc-1",
      expect.objectContaining({ title: "Vedtekter for Biso" })
    );
  });

  test("never persists a campus or department on a national document", async () => {
    mockTables({ documents: [existingDoc] });

    const result = await updateDocumentMetadata("doc-1", {
      ...existingMetadata,
      campus_id: "campus-oslo",
      department_id: "dept-1",
    });

    expect(result).toEqual({ data: "doc-1" });
    expect(db.updateRow).toHaveBeenCalledWith(
      "app",
      "documents",
      "doc-1",
      expect.objectContaining({
        campus: null,
        campus_id: null,
        department: null,
      })
    );
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

    expect(result).toEqual({ data: "doc-1", publicLink: true, version: "13" });
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
    // The link is requested again for the current item, which repairs a
    // document that was first saved without a public link.
    expect(sp.createAnonymousViewLink).toHaveBeenCalledWith(
      "drive-1",
      "current-item"
    );
    const payload = db.updateRow.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload.sharepoint_web_url).toBe("https://sp.example/:b:/g/public");
  });

  test("keeps the stored link and says so when no public link can be created", async () => {
    mockTables({ document_versions: [version12Row], documents: [existingDoc] });
    const failure = new Error("sharingDisabled");
    sp.createAnonymousViewLink.mockRejectedValue(failure);
    const consoleError = captureConsoleError();

    const result = await uploadNewVersion("doc-1", "13", pdfFormData());

    expect(result).toEqual({ data: "doc-1", publicLink: false, version: "13" });
    const payload = db.updateRow.mock.calls[0]?.[3] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("sharepoint_web_url");
    expect(payload).toMatchObject({ version: "13", version_number: 13 });
    expect(consoleError).toHaveBeenCalledWith(
      "SharePoint public link could not be created:",
      failure
    );
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

    const rejected = await uploadNewVersion("doc-1", "11", pdfFormData());
    expect(rejected).toEqual({
      error: "Version must be higher than the current v12",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();

    const accepted = await uploadNewVersion("doc-1", "12.1", pdfFormData());
    expect(accepted).toEqual({
      data: "doc-1",
      publicLink: true,
      version: "12.1",
    });
  });

  test("re-uploading the current version records its missing history row", async () => {
    mockTables({ documents: [existingDoc] });

    const result = await uploadNewVersion("doc-1", "12", pdfFormData());

    expect(result).toEqual({ data: "doc-1", publicLink: true, version: "12" });
    expect(db.createRow).toHaveBeenCalledTimes(1);
    expect(db.createRow).toHaveBeenCalledWith(
      "app",
      "document_versions",
      expect.any(String),
      expect.objectContaining({ version_major: 12, version_minor: 0 })
    );
  });

  test("a failed documents update is reported, and the same version then finishes without a second history row", async () => {
    const versionRows: Record<string, unknown>[] = [version12Row];
    mockTables({ document_versions: versionRows, documents: [existingDoc] });
    db.createRow.mockImplementation(
      (
        _databaseId: string,
        _tableId: string,
        rowId: string,
        data: Record<string, unknown>
      ) => {
        versionRows.push({ $id: rowId, ...data });
        return Promise.resolve({ $id: rowId });
      }
    );
    db.updateRow.mockRejectedValueOnce(new Error("Server Error"));

    const failed = await uploadNewVersion("doc-1", "13", pdfFormData());

    expect(failed).toEqual({
      error:
        "Saved to SharePoint but the database write failed: Server Error. Upload the same version again to finish.",
      sharePointError: false,
    });
    expect(db.createRow).toHaveBeenCalledTimes(1);

    // The history row for v13 now exists; the document still says v12.
    const retried = await uploadNewVersion("doc-1", "13", pdfFormData());

    expect(retried).toEqual({ data: "doc-1", publicLink: true, version: "13" });
    expect(db.createRow).toHaveBeenCalledTimes(1);
    expect(db.updateRow).toHaveBeenLastCalledWith(
      "app",
      "documents",
      "doc-1",
      expect.objectContaining({ version: "13", version_number: 13 })
    );
  });

  test("a failed history insert is reported and leaves the document untouched", async () => {
    mockTables({ document_versions: [version12Row], documents: [existingDoc] });
    db.createRow.mockRejectedValue(new Error("Table not found"));

    const result = await uploadNewVersion("doc-1", "13", pdfFormData());

    expect(result).toEqual({
      error:
        "Saved to SharePoint but the database write failed: Table not found. Upload the same version again to finish.",
      sharePointError: false,
    });
    expect(db.updateRow).not.toHaveBeenCalled();
  });

  test("still rejects a lower version while a newer one is half recorded", async () => {
    mockTables({
      document_versions: [
        version12Row,
        { ...version12Row, $id: "ver-13", version_major: 13 },
      ],
      documents: [existingDoc],
    });

    const result = await uploadNewVersion("doc-1", "12.5", pdfFormData());

    expect(result).toEqual({
      error: "Version must be higher than the current v13",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
  });

  test("refuses a campus admin of another campus before touching SharePoint", async () => {
    currentCtx = bergenCampusAdminCtx;
    mockTables({ document_versions: [version12Row], documents: [osloDoc] });

    await expect(
      uploadNewVersion("doc-1", "13", pdfFormData())
    ).rejects.toThrow("Unauthorized: no write access to this campus");

    expect(sp.uploadNewFile).not.toHaveBeenCalled();
    expect(sp.replaceFileInPlace).not.toHaveBeenCalled();
    expect(sp.createAnonymousViewLink).not.toHaveBeenCalled();
    expect(db.createRow).not.toHaveBeenCalled();
    expect(db.updateRow).not.toHaveBeenCalled();
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

  test("returns nothing for a document that does not exist", async () => {
    mockTables({});
    expect(await listDocumentVersions("missing")).toEqual([]);
  });

  test("returns nothing for an existing document outside the caller's campus", async () => {
    currentCtx = bergenCampusAdminCtx;
    mockTables({ document_versions: [version12Row], documents: [osloDoc] });

    expect(await listDocumentVersions("doc-1")).toEqual([]);
    // The history table is never read for a document the caller cannot see.
    const tablesRead = db.listRows.mock.calls.map((call) => call[1]);
    expect(tablesRead).not.toContain("document_versions");
  });

  test("returns an empty history and logs when the history table cannot be read", async () => {
    const failure = new Error("Table with the requested ID could not be found");
    db.listRows.mockImplementation((_databaseId: string, tableId: string) => {
      if (tableId === "document_versions") {
        throw failure;
      }
      return { rows: [existingDoc], total: 1 };
    });
    const consoleError = captureConsoleError();

    expect(await listDocumentVersions("doc-1")).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to list document versions:",
      failure
    );
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

describe("control committee", () => {
  beforeEach(() => {
    currentCtx = controlCommitteeCtx;
  });

  test("creates a national document", async () => {
    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({ data: "doc-new", publicLink: true });
    expect(db.upsertRow).toHaveBeenCalledWith(
      "app",
      "documents",
      expect.stringMatching(APPWRITE_ROW_ID),
      expect.objectContaining({
        scope: "national",
        updated_by: "user-committee",
      })
    );
  });

  test("uploads a new version of another campus's document", async () => {
    mockTables({
      campus: [{ $id: "campus-oslo", name: "Oslo" }],
      document_versions: [version12Row],
      documents: [osloDoc],
    });

    const result = await uploadNewVersion("doc-1", "13", pdfFormData());

    expect(result).toEqual({ data: "doc-1", publicLink: true, version: "13" });
    expect(sp.replaceFileInPlace).toHaveBeenCalledTimes(1);
  });

  test("edits and publishes a national document", async () => {
    mockTables({ documents: [{ ...existingDoc, status: "draft" }] });

    const result = await updateDocumentMetadata("doc-1", {
      ...existingMetadata,
      description: "Adopted at the national meeting",
      status: "published",
    });

    expect(result).toEqual({ data: "doc-1" });
  });

  test("deletes another campus's document", async () => {
    mockTables({ documents: [osloDoc] });

    const result = await deleteDocument("doc-1");

    expect(result).toEqual({ data: true });
    expect(db.deleteRow).toHaveBeenCalledWith("app", "documents", "doc-1");
  });

  test("lists documents from every campus", async () => {
    mockTables({ documents: [existingDoc, osloDoc] });

    const result = await listDocuments();

    expect(result.total).toBe(2);
    const queries = db.listRows.mock.calls[0]?.[2] as string[];
    for (const query of queries) {
      expect(query).not.toContain("campus.$id");
      expect(query).not.toContain("department.$id");
      expect(query).not.toContain("__no_scope_resolved__");
    }
  });

  test("may assign any department of a campus", async () => {
    mockTables({
      departments: [{ $id: "dept-oslo-a" }, { $id: "dept-oslo-b" }],
    });

    const departments = await listDepartmentsForDocument("campus-oslo");

    expect(departments.map((row) => row.$id)).toEqual([
      "dept-oslo-a",
      "dept-oslo-b",
    ]);
  });

  test("is audited under the member's own identity, not an admin's", async () => {
    logAuditEvent.mockClear();

    await createDocument(nationalValues, pdfFormData());

    const auditedCtx = logAuditEvent.mock.calls[0]?.[0] as UserAuthContext;
    expect(auditedCtx.userId).toBe("user-committee");
    expect(auditedCtx.roles).not.toContain("globaladmin");
  });

  test("reads the version history of another campus's document", async () => {
    mockTables({ document_versions: [version12Row], documents: [osloDoc] });

    const versions = await listDocumentVersions("doc-1");

    expect(versions.map((row) => row.$id)).toEqual(["ver-12"]);
  });
});

describe("other department members", () => {
  beforeEach(() => {
    currentCtx = otherDepartmentCtx;
  });

  test("cannot create a national document", async () => {
    const result = await createDocument(nationalValues, pdfFormData());

    expect(result).toEqual({
      error:
        "Only global admins and the control committee can create national documents",
      sharePointError: false,
    });
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
  });

  test("cannot upload a version of a campus-wide document", async () => {
    mockTables({
      documents: [
        {
          ...osloDoc,
          campus: { $id: "campus-bergen" },
          campus_id: "campus-bergen",
        },
      ],
    });

    await expect(
      uploadNewVersion("doc-1", "13", pdfFormData())
    ).rejects.toThrow("Unauthorized");
    expect(sp.uploadNewFile).not.toHaveBeenCalled();
    expect(sp.replaceFileInPlace).not.toHaveBeenCalled();
  });

  test("still list only their own campus and department", async () => {
    await listDocuments();

    const queries = (db.listRows.mock.calls[0]?.[2] as string[]).join(" ");
    expect(queries).toContain("campus.$id");
    expect(queries).toContain("department.$id");
  });

  test("may only assign their own departments", async () => {
    mockTables({
      departments: [{ $id: "dept-finance" }, { $id: "dept-other" }],
    });

    const departments = await listDepartmentsForDocument("campus-bergen");

    expect(departments.map((row) => row.$id)).toEqual(["dept-finance"]);
  });

  test("cannot delete a national document", async () => {
    mockTables({ documents: [existingDoc] });

    await expect(deleteDocument("doc-1")).rejects.toThrow("Unauthorized");
    expect(db.deleteRow).not.toHaveBeenCalled();
  });
});
