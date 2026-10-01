"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  type Campus,
  type Departments,
  type Documents,
  DocumentsCategory,
  type DocumentsLanguage,
  type DocumentsScope,
  type DocumentsStatus,
  type DocumentVersions,
} from "@repo/api/types/appwrite";
import {
  getSharePointConfig,
  SharePointService,
} from "@repo/connectors/sharepoint";
import {
  compareDocumentVersions,
  type DocumentVersion,
  formatDocumentVersion,
  parseDocumentVersion,
} from "@repo/shared/utils/document-version";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import {
  applyContentRelationshipScopeQueries,
  assertContentOwnership,
  getContentOwnership,
} from "@/lib/content-authorization";
import {
  canManageAllDocuments,
  documentAccessContext,
} from "@/lib/documents/access";
import {
  buildDocumentFileNames,
  type DocumentLanguage,
  documentPathKey,
  getDocumentsDriveId,
  PREVIOUS_VERSIONS_FOLDER,
  resolveFolderPath,
} from "@/lib/documents/sharepoint-mapping";
import {
  assertPublishAccess,
  assertWriteAccess,
  hasRowAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import { listDepartmentsForCampus } from "./lookups";
import {
  DOCUMENTS_PAGE_SIZE,
  type DocumentCreateFormValues,
  type DocumentMetadataFormValues,
  documentCreateSchema,
  documentMetadataSchema,
  documentVersionSchema,
} from "./schemas";

function getSharePointService() {
  return new SharePointService(getSharePointConfig());
}

const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

const LOG_PREFIX = "[documents]";

/** Logs why an action stopped, then returns the user-facing error. */
function rejected(
  action: string,
  error: string,
  detail?: unknown
): { error: string; sharePointError: false } {
  console.warn(`${LOG_PREFIX} ${action} rejected: ${error}`, detail ?? "");
  return { error, sharePointError: false };
}

/** Campus name feeds the SharePoint subfolder path (used by campus-bylaws). */
async function resolveCampusNameForPath(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  scope: string,
  campusId: string | null | undefined
): Promise<string | null> {
  if (!(scope === "campus" && campusId)) {
    return null;
  }
  const campusRows = await db.listRows<Campus>("app", "campus", [
    Query.equal("$id", campusId),
    Query.limit(1),
  ]);
  return campusRows.rows[0]?.name ?? null;
}

type AdminDb = Awaited<ReturnType<typeof createAdminClient>>["db"];
type SharePointFile = Awaited<ReturnType<SharePointService["uploadNewFile"]>>;

// Same ceiling as the shared department lookup.
const MAX_DEPARTMENTS_PER_CAMPUS = 200;

// Upper bound on history rows read per document; far above any real count.
const MAX_VERSIONS_PER_DOCUMENT = 500;

type SharePointPublishOutcome =
  | { error: string; ok: false }
  | { archived: SharePointFile; current: SharePointFile; ok: true };

/**
 * Writes one version to SharePoint: a per-version copy under "Previous
 * versions", then the document's current file (created on first upload,
 * replaced in place afterwards so its URL never changes).
 */
async function publishVersionToSharePoint(input: {
  buffer: Buffer;
  campusName: string | null;
  category: string;
  existing: { driveId: string; itemId: string } | null;
  language: DocumentLanguage;
  title: string;
  version: string;
}): Promise<SharePointPublishOutcome> {
  let driveId: string;
  let folderPath: string;
  try {
    driveId = getDocumentsDriveId();
    folderPath = resolveFolderPath(
      input.category,
      input.language,
      input.campusName
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${LOG_PREFIX} SharePoint is not configured:`, err);
    return { error: `SharePoint is not configured: ${message}`, ok: false };
  }

  const names = buildDocumentFileNames(input.title, input.version);
  const target = {
    archivedName: names.archived,
    bytes: input.buffer.byteLength,
    currentName: names.current,
    folderPath,
    replacesItem: input.existing?.itemId ?? null,
  };
  console.info(`${LOG_PREFIX} uploading to SharePoint`, target);
  try {
    const sp = getSharePointService();
    const archived = await sp.uploadNewFile(
      driveId,
      `${folderPath}/${PREVIOUS_VERSIONS_FOLDER}`,
      names.archived,
      input.buffer
    );
    console.info(`${LOG_PREFIX} archived version uploaded`, {
      itemId: archived.itemId,
    });
    const current = input.existing
      ? await sp.replaceFileInPlace(
          input.existing.driveId,
          input.existing.itemId,
          input.buffer
        )
      : await sp.uploadNewFile(
          driveId,
          folderPath,
          names.current,
          input.buffer
        );
    console.info(`${LOG_PREFIX} current file uploaded`, {
      itemId: current.itemId,
      webUrl: current.webUrl,
    });
    return { archived, current, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // The raw Graph error carries the status code and response body.
    console.error(`${LOG_PREFIX} SharePoint upload failed`, target, err);
    return { error: `SharePoint upload failed: ${message}`, ok: false };
  }
}

/**
 * "Anyone with the link" URL for the current file, or null when the tenant or
 * site forbids anonymous links. Never fails the upload.
 */
async function createPublicLink(file: SharePointFile): Promise<string | null> {
  try {
    return await getSharePointService().createAnonymousViewLink(
      file.driveId,
      file.itemId
    );
  } catch (error) {
    console.error("SharePoint public link could not be created:", error);
    return null;
  }
}

async function listVersionRows(
  db: AdminDb,
  documentId: string
): Promise<DocumentVersions[]> {
  const response = await db.listRows<DocumentVersions>(
    "app",
    "document_versions",
    [
      Query.equal("document_id", documentId),
      Query.limit(MAX_VERSIONS_PER_DOCUMENT),
    ]
  );
  return response.rows;
}

function toVersion(row: DocumentVersions): DocumentVersion {
  return { major: row.version_major, minor: row.version_minor ?? 0 };
}

/** Highest known version: history rows first, then the document's own label. */
function latestKnownVersion(
  doc: Documents,
  rows: DocumentVersions[]
): DocumentVersion | null {
  const known = rows.map(toVersion);
  const own = parseDocumentVersion(doc.version);
  if (own) {
    known.push(own);
  }
  return known.sort(compareDocumentVersions).at(-1) ?? null;
}

/**
 * A version may be uploaded when it is higher than the latest known one, or
 * equal to it while only half recorded (its history row is missing, or the
 * document row still shows an older version). The second case lets a retry
 * finish an upload whose database writes failed part-way.
 */
function isUploadableVersion(
  doc: Documents,
  version: DocumentVersion,
  latest: DocumentVersion,
  rowExists: boolean
): boolean {
  const order = compareDocumentVersions(version, latest);
  if (order !== 0) {
    return order > 0;
  }
  const own = parseDocumentVersion(doc.version);
  const docAtVersion =
    own !== null && compareDocumentVersions(own, version) === 0;
  return !(rowExists && docAtVersion);
}

async function recordVersion(
  db: AdminDb,
  input: {
    documentId: string;
    file: SharePointFile;
    userId: string;
    version: DocumentVersion;
  }
): Promise<void> {
  await db.createRow("app", "document_versions", ID.unique(), {
    document_id: input.documentId,
    file_name: input.file.name,
    file_size: input.file.size,
    sharepoint_drive_id: input.file.driveId,
    sharepoint_item_id: input.file.itemId,
    uploaded_by: input.userId,
    version_major: input.version.major,
    version_minor: input.version.minor,
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The files are already in SharePoint when a database write fails, so the
 * message says so and tells the user how to finish.
 */
function databaseWriteFailure(
  error: unknown,
  nextStep: string
): { error: string; sharePointError: false } {
  return {
    error: `Saved to SharePoint but the database write failed: ${errorMessage(error)}. ${nextStep}`,
    sharePointError: false,
  };
}

/** Categories the form may offer before the documents table accepts them. */
function isEnabledCategory(category: string): category is DocumentsCategory {
  return (Object.values(DocumentsCategory) as string[]).includes(category);
}

function validateDocumentFile(
  formData: FormData
): { error: string; ok: false } | { file: File; ok: true } {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "A PDF file is required", ok: false };
  }
  if (file.type !== "application/pdf") {
    return { error: "Only PDF files are allowed", ok: false };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: "File must be under 50 MB", ok: false };
  }
  return { file, ok: true };
}

export async function listDocuments(opts?: { status?: string; page?: number }) {
  // Control committee members reach every document; see documentAccessContext.
  const access = documentAccessContext(await requireAuth());
  // Private admin read: the service client bypasses row security, so the
  // relationship scope filters below are the authorization boundary.
  const { db } = await createAdminClient();
  const page = Math.max(1, opts?.page ?? 1);

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.limit(DOCUMENTS_PAGE_SIZE),
    Query.offset((page - 1) * DOCUMENTS_PAGE_SIZE),
    ...applyContentRelationshipScopeQueries(access),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  const response = await db.listRows<Documents>("app", "documents", queries);
  return { rows: response.rows, total: response.total };
}

/**
 * Departments the caller may assign a document to. Whoever manages every
 * document may pick any department of the campus; everyone else gets the
 * shared lookup's answer (their own departments, or all for campus admins).
 */
export async function listDepartmentsForDocument(
  campusId: string
): Promise<Departments[]> {
  const ctx = await requireAuth();
  if (!canManageAllDocuments(ctx)) {
    return listDepartmentsForCampus(campusId);
  }
  const { db } = await createAdminClient();
  const response = await db.listRows<Departments>("app", "departments", [
    Query.equal("campus_id", campusId),
    Query.orderAsc("Name"),
    Query.limit(MAX_DEPARTMENTS_PER_CAMPUS),
  ]);
  return response.rows;
}

export async function getDocument(id: string) {
  const access = documentAccessContext(await requireAuth());
  const { db } = await createAdminClient();

  const response = await db.listRows<Documents>("app", "documents", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const doc = response.rows[0] ?? null;
  if (!doc) {
    return null;
  }
  // Treat a row outside the caller's campus/department scope as not found.
  const ownership = getContentOwnership(doc, { legacyFallback: true });
  if (!hasRowAccess(access, ownership.campus, ownership.department)) {
    return null;
  }
  return doc;
}

const CAMPUS_NOT_FOUND_ERROR = "Campus not found for this document";

// Action names as they appear in the server log.
const CREATE_ACTION = "createDocument";
const VERSION_ACTION = "uploadNewVersion";

const PATH_LOCKED_ERROR =
  "The title, category, language, scope and campus decide where the file is stored in SharePoint and cannot be changed after upload. Create a new document instead.";

/** Path identity of submitted form values, where the campus may be left out. */
function formPathKey(values: DocumentMetadataFormValues): string {
  return documentPathKey({ ...values, campus_id: values.campus_id });
}

// Upper bound on documents read per category for the collision check.
const MAX_COLLISION_CANDIDATES = 500;

/**
 * The current file is addressed by category, language, campus folder and
 * sanitised title, so two documents collide when their path keys match, not
 * only when the raw titles do. Language is compared through the key rather
 * than in the query, because a row stored without one is filed as Norwegian.
 */
async function hasFileNameCollision(
  db: AdminDb,
  values: DocumentMetadataFormValues
): Promise<boolean> {
  const candidates = await db.listRows<Documents>("app", "documents", [
    Query.equal("category", values.category),
    Query.limit(MAX_COLLISION_CANDIDATES),
  ]);
  const pathKey = formPathKey(values);
  return candidates.rows.some((row) => documentPathKey(row) === pathKey);
}

/** A national document never carries a campus or department. */
function withEffectiveOwnership<T extends DocumentMetadataFormValues>(
  values: T
): T {
  return values.scope === "national"
    ? { ...values, campus_id: null, department_id: null }
    : values;
}

/** Returns a user-facing message when the caller may not create this document. */
async function checkCreateAccess(
  db: AdminDb,
  ctx: Awaited<ReturnType<typeof requireAuth>>,
  values: DocumentMetadataFormValues
): Promise<string | null> {
  try {
    // National documents may keep a null campus (global admins only); campus
    // documents require a campus, and department authors their own department.
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: values.scope === "national",
      campusId: values.campus_id ?? null,
      departmentId: values.department_id ?? null,
    });
    if (values.status === "published") {
      assertPublishAccess(
        ctx,
        values.campus_id ?? null,
        values.department_id ?? null
      );
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Document access denied";
  }
}

/**
 * Writes the documents row and its first history row. If the history row
 * fails, the documents row is removed again so a retry passes the collision
 * guard and overwrites the same SharePoint paths.
 */
async function persistNewDocument(
  db: AdminDb,
  input: {
    archived: SharePointFile;
    row: Record<string, unknown>;
    userId: string;
    version: DocumentVersion;
  }
): Promise<{ id: string; ok: true } | { error: unknown; ok: false }> {
  let documentId: string;
  try {
    // A generated id: upsert takes the id in the URL, where Appwrite rejects
    // the literal "unique()" placeholder that create accepts.
    const doc = await db.upsertRow("app", "documents", ID.unique(), input.row);
    documentId = doc.$id;
  } catch (error) {
    console.error(`${LOG_PREFIX} documents row insert failed:`, error);
    return { error, ok: false };
  }
  try {
    await recordVersion(db, {
      documentId,
      file: input.archived,
      userId: input.userId,
      version: input.version,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} document_versions row insert failed:`, error);
    try {
      await db.deleteRow("app", "documents", documentId);
    } catch (cleanupError) {
      // Best effort: the original failure is what the user needs to see.
      console.error(
        `${LOG_PREFIX} could not remove documents row ${documentId} after the failed insert:`,
        cleanupError
      );
    }
    return { error, ok: false };
  }
  return { id: documentId, ok: true };
}

export async function createDocument(
  metadata: DocumentCreateFormValues,
  formData: FormData
): Promise<
  | {
      data: string;
      publicLink: boolean;
      error?: never;
      sharePointError?: never;
    }
  | { error: string; sharePointError: boolean; data?: never }
> {
  const ctx = await requireAuth();
  const access = documentAccessContext(ctx);
  const parsed = documentCreateSchema.safeParse(metadata);
  const version = parsed.success
    ? parseDocumentVersion(parsed.data.version)
    : null;
  if (!(parsed.success && version)) {
    return rejected(
      CREATE_ACTION,
      "Invalid form data",
      parsed.success ? metadata.version : parsed.error.issues
    );
  }
  const values = withEffectiveOwnership(parsed.data);

  const { campus_id, scope, category, language, title } = values;
  console.info(`${LOG_PREFIX} ${CREATE_ACTION} started`, {
    campus_id,
    category,
    language,
    scope,
    title,
    userId: ctx.userId,
    version: parsed.data.version,
  });

  if (scope === "national" && !access.roles.includes("globaladmin")) {
    return rejected(
      CREATE_ACTION,
      "Only global admins and the control committee can create national documents",
      { roles: ctx.roles }
    );
  }

  const { db } = await createAdminClient();
  const accessError = await checkCreateAccess(db, access, values);
  if (accessError) {
    return rejected(CREATE_ACTION, accessError);
  }

  if (!isEnabledCategory(category)) {
    return rejected(
      CREATE_ACTION,
      "This category is not enabled in the database yet. Ask IT to add it to the documents table.",
      { category }
    );
  }

  const fileCheck = validateDocumentFile(formData);
  if (!fileCheck.ok) {
    return rejected(CREATE_ACTION, fileCheck.error);
  }

  if (await hasFileNameCollision(db, values)) {
    return rejected(
      CREATE_ACTION,
      "A document with this title already exists in this category. Open it and upload a new version instead.",
      { pathKey: formPathKey(values) }
    );
  }

  const campusName = await resolveCampusNameForPath(db, scope, campus_id);
  if (scope === "campus" && !campusName) {
    return rejected(CREATE_ACTION, CAMPUS_NOT_FOUND_ERROR, { campus_id });
  }
  const buffer = Buffer.from(await fileCheck.file.arrayBuffer());
  const versionLabel = formatDocumentVersion(version);

  const published = await publishVersionToSharePoint({
    buffer,
    campusName,
    category,
    existing: null,
    language,
    title,
    version: versionLabel,
  });
  if (!published.ok) {
    return { error: published.error, sharePointError: true };
  }
  const publicUrl = await createPublicLink(published.current);

  const saved = await persistNewDocument(db, {
    archived: published.archived,
    row: {
      title,
      description: values.description ?? null,
      category,
      scope: scope as DocumentsScope,
      // Canonical ownership relationships; the scalar column remains as
      // migration-era compatibility metadata only.
      campus: campus_id ?? null,
      campus_id: campus_id ?? null,
      department: values.department_id ?? null,
      language: language as DocumentsLanguage,
      version: versionLabel,
      version_number: version.major,
      sharepoint_item_id: published.current.itemId,
      sharepoint_drive_id: published.current.driveId,
      sharepoint_web_url: publicUrl ?? published.current.webUrl,
      file_size: published.current.size,
      status: values.status as DocumentsStatus,
      updated_by: ctx.userId,
    },
    userId: ctx.userId,
    version,
  });
  if (!saved.ok) {
    return databaseWriteFailure(saved.error, "Try again.");
  }
  console.info(`${LOG_PREFIX} ${CREATE_ACTION} saved`, {
    documentId: saved.id,
    publicLink: publicUrl !== null,
  });

  await logAuditEvent(ctx, "document.create", {
    resourceId: saved.id,
    resourceType: "document",
  });
  revalidatePath("/documents");
  return { data: saved.id, publicLink: publicUrl !== null };
}

export async function updateDocumentMetadata(
  id: string,
  values: DocumentMetadataFormValues
): Promise<{ data: string } | { error: string }> {
  const ctx = await requireAuth();
  const access = documentAccessContext(ctx);
  const validated = documentMetadataSchema.safeParse(values);
  if (!validated.success) {
    return { error: "Invalid form data" };
  }

  const { db } = await createAdminClient();
  const existing = await db.listRows<Documents>("app", "documents", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const doc = existing.rows[0];
  if (!doc) {
    return { error: "Document not found" };
  }

  const next = withEffectiveOwnership(validated.data);

  if (next.scope === "national" && !access.roles.includes("globaladmin")) {
    return {
      error:
        "Only global admins and the control committee can manage national documents",
    };
  }

  // Authorize both the persisted scope and the requested scope so ownership
  // transfers require access on each side.
  const persisted = getContentOwnership(doc, { legacyFallback: true });
  assertWriteAccess(access, persisted.campus, persisted.department);
  await assertContentOwnership(db, access, {
    allowGlobalCampus: next.scope === "national",
    campusId: next.campus_id ?? null,
    departmentId: next.department_id ?? null,
  });
  if (doc.status === "published" || next.status === "published") {
    assertPublishAccess(access, persisted.campus, persisted.department);
    assertPublishAccess(
      access,
      next.campus_id ?? null,
      next.department_id ?? null
    );
  }

  // The file stays where it was uploaded, so an edit that would address a
  // different path is refused: otherwise a later document could take over the
  // old path and overwrite this document's public file.
  if (documentPathKey(doc) !== formPathKey(next)) {
    return { error: PATH_LOCKED_ERROR };
  }

  await db.updateRow("app", "documents", id, {
    title: next.title,
    description: next.description ?? null,
    category: next.category as DocumentsCategory,
    scope: next.scope as DocumentsScope,
    campus: next.campus_id ?? null,
    campus_id: next.campus_id ?? null,
    department: next.department_id ?? null,
    language: next.language,
    status: next.status as DocumentsStatus,
    updated_by: ctx.userId,
  });

  await logAuditEvent(ctx, "document.update", {
    resourceId: id,
    resourceType: "document",
  });
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { data: id };
}

export async function uploadNewVersion(
  id: string,
  versionInput: string,
  formData: FormData
): Promise<
  | {
      data: string;
      publicLink: boolean;
      version: string;
      error?: never;
      sharePointError?: never;
    }
  | { error: string; sharePointError: boolean; data?: never }
> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const existing = await db.listRows<Documents>("app", "documents", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const doc = existing.rows[0];
  if (!doc) {
    return rejected(VERSION_ACTION, "Document not found", { id });
  }
  console.info(`${LOG_PREFIX} ${VERSION_ACTION} started`, {
    currentVersion: doc.version,
    documentId: id,
    requestedVersion: versionInput,
    userId: ctx.userId,
  });

  const versionOwnership = getContentOwnership(doc, { legacyFallback: true });
  assertWriteAccess(
    documentAccessContext(ctx),
    versionOwnership.campus,
    versionOwnership.department
  );

  const parsedInput = documentVersionSchema.safeParse(versionInput);
  const version = parsedInput.success
    ? parseDocumentVersion(parsedInput.data)
    : null;
  if (!version) {
    return rejected(VERSION_ACTION, "Version must be a number like 12 or 7.1", {
      versionInput,
    });
  }

  const versionRows = await listVersionRows(db, id);
  const latest = latestKnownVersion(doc, versionRows);
  const rowExists = versionRows.some(
    (row) => compareDocumentVersions(toVersion(row), version) === 0
  );
  if (latest && !isUploadableVersion(doc, version, latest, rowExists)) {
    return rejected(
      VERSION_ACTION,
      `Version must be higher than the current v${formatDocumentVersion(latest)}`,
      { historyRows: versionRows.length, rowExists }
    );
  }

  const fileCheck = validateDocumentFile(formData);
  if (!fileCheck.ok) {
    return rejected(VERSION_ACTION, fileCheck.error);
  }
  const campusName = await resolveCampusNameForPath(
    db,
    doc.scope,
    doc.campus_id
  );
  if (doc.scope === "campus" && !campusName) {
    return rejected(VERSION_ACTION, CAMPUS_NOT_FOUND_ERROR, {
      campus_id: doc.campus_id,
    });
  }
  const buffer = Buffer.from(await fileCheck.file.arrayBuffer());
  const versionLabel = formatDocumentVersion(version);

  const published = await publishVersionToSharePoint({
    buffer,
    campusName,
    category: doc.category,
    existing: {
      driveId: doc.sharepoint_drive_id,
      itemId: doc.sharepoint_item_id,
    },
    language: (doc.language ?? "no") as DocumentLanguage,
    title: doc.title,
    version: versionLabel,
  });
  if (!published.ok) {
    return { error: published.error, sharePointError: true };
  }

  // Asking again is idempotent and repairs a document that was first saved
  // without a public link. When it fails, the stored URL is left alone.
  const publicUrl = await createPublicLink(published.current);

  try {
    if (!rowExists) {
      await recordVersion(db, {
        documentId: id,
        file: published.archived,
        userId: ctx.userId,
        version,
      });
    }
    await db.updateRow("app", "documents", id, {
      version: versionLabel,
      version_number: version.major,
      file_size: published.current.size,
      updated_by: ctx.userId,
      ...(publicUrl === null ? {} : { sharepoint_web_url: publicUrl }),
    });
  } catch (error) {
    console.error(
      `${LOG_PREFIX} ${VERSION_ACTION} database write failed for ${id}:`,
      error
    );
    return databaseWriteFailure(
      error,
      "Upload the same version again to finish."
    );
  }
  console.info(`${LOG_PREFIX} ${VERSION_ACTION} saved`, {
    documentId: id,
    publicLink: publicUrl !== null,
    version: versionLabel,
  });

  await logAuditEvent(ctx, "document.version_upload", {
    resourceId: id,
    resourceType: "document",
    payload: { version: versionLabel },
  });
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { data: id, publicLink: publicUrl !== null, version: versionLabel };
}

export async function listDocumentVersions(
  id: string
): Promise<DocumentVersions[]> {
  // getDocument applies the caller's campus/department scope.
  const doc = await getDocument(id);
  if (!doc) {
    return [];
  }
  const { db } = await createAdminClient();
  let rows: DocumentVersions[];
  try {
    rows = await listVersionRows(db, id);
  } catch (error) {
    // Keeps the editor usable before the document_versions table is pushed.
    console.error("Failed to list document versions:", error);
    return [];
  }
  return rows.sort((a, b) =>
    compareDocumentVersions(toVersion(b), toVersion(a))
  );
}

export async function deleteDocument(
  id: string
): Promise<{ data: true } | { error: string }> {
  const ctx = await requireAuth();
  const { db } = await createAdminClient();

  const existing = await db.listRows<Documents>("app", "documents", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const doc = existing.rows[0];
  if (!doc) {
    return { error: "Document not found" };
  }

  const ownership = getContentOwnership(doc, { legacyFallback: true });
  assertWriteAccess(
    documentAccessContext(ctx),
    ownership.campus,
    ownership.department
  );

  // NOTE: SharePoint files are kept on purpose; only the Appwrite rows go.
  for (const versionRow of await listVersionRows(db, id)) {
    await db.deleteRow("app", "document_versions", versionRow.$id);
  }
  await db.deleteRow("app", "documents", id);

  await logAuditEvent(ctx, "document.delete", {
    resourceId: id,
    resourceType: "document",
  });
  revalidatePath("/documents");
  return { data: true };
}
