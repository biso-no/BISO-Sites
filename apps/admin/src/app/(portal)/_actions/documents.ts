"use server";

import { ID, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  Campus,
  Documents,
  DocumentsCategory,
  DocumentsLanguage,
  DocumentsScope,
  DocumentsStatus,
  DocumentVersions,
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
  buildDocumentFileNames,
  type DocumentLanguage,
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
    return { error: `SharePoint is not configured: ${message}`, ok: false };
  }

  const names = buildDocumentFileNames(input.title, input.version);
  try {
    const sp = getSharePointService();
    const archived = await sp.uploadNewFile(
      driveId,
      `${folderPath}/${PREVIOUS_VERSIONS_FOLDER}`,
      names.archived,
      input.buffer
    );
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
    return { archived, current, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
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
  } catch {
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
  const ctx = await requireAuth();
  // Private admin read: the service client bypasses row security, so the
  // relationship scope filters below are the authorization boundary.
  const { db } = await createAdminClient();
  const page = Math.max(1, opts?.page ?? 1);

  const queries: string[] = [
    Query.orderDesc("$updatedAt"),
    Query.limit(DOCUMENTS_PAGE_SIZE),
    Query.offset((page - 1) * DOCUMENTS_PAGE_SIZE),
    ...applyContentRelationshipScopeQueries(ctx),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  const response = await db.listRows<Documents>("app", "documents", queries);
  return { rows: response.rows, total: response.total };
}

export async function getDocument(id: string) {
  const ctx = await requireAuth();
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
  if (!hasRowAccess(ctx, ownership.campus, ownership.department)) {
    return null;
  }
  return doc;
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
  const validated = documentCreateSchema.safeParse(metadata);
  const version = validated.success
    ? parseDocumentVersion(validated.data.version)
    : null;
  if (!(validated.success && version)) {
    return { error: "Invalid form data", sharePointError: false };
  }

  const { campus_id, scope, category, language, title } = validated.data;

  if (scope === "national" && !ctx.roles.includes("globaladmin")) {
    return {
      error: "Only global admins can create national documents",
      sharePointError: false,
    };
  }

  const { db } = await createAdminClient();
  const accessError = await checkCreateAccess(db, ctx, validated.data);
  if (accessError) {
    return { error: accessError, sharePointError: false };
  }

  const fileCheck = validateDocumentFile(formData);
  if (!fileCheck.ok) {
    return { error: fileCheck.error, sharePointError: false };
  }

  // The current file is named after the title, so two documents with the same
  // title, category and language would share one file (campus is checked
  // below because a null campus cannot be queried with equal()).
  const sameName = await db.listRows<Documents>("app", "documents", [
    Query.equal("title", title),
    Query.equal("category", category),
    Query.equal("language", language),
    Query.limit(25),
  ]);
  const collides = sameName.rows.some(
    (row) => (row.campus_id ?? null) === (campus_id ?? null)
  );
  if (collides) {
    return {
      error:
        "A document with this title already exists in this category. Open it and upload a new version instead.",
      sharePointError: false,
    };
  }

  const buffer = Buffer.from(await fileCheck.file.arrayBuffer());
  const campusName = await resolveCampusNameForPath(db, scope, campus_id);
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

  const doc = await db.upsertRow("app", "documents", "unique()", {
    title,
    description: validated.data.description ?? null,
    category: category as DocumentsCategory,
    scope: scope as DocumentsScope,
    // Canonical ownership relationships; the scalar column remains as
    // migration-era compatibility metadata only.
    campus: campus_id ?? null,
    campus_id: campus_id ?? null,
    department: validated.data.department_id ?? null,
    language: language as DocumentsLanguage,
    version: versionLabel,
    version_number: version.major,
    sharepoint_item_id: published.current.itemId,
    sharepoint_drive_id: published.current.driveId,
    sharepoint_web_url: publicUrl ?? published.current.webUrl,
    file_size: published.current.size,
    status: validated.data.status as DocumentsStatus,
    updated_by: ctx.userId,
  });
  await recordVersion(db, {
    documentId: doc.$id,
    file: published.archived,
    userId: ctx.userId,
    version,
  });

  await logAuditEvent(ctx, "document.create", {
    resourceId: doc.$id,
    resourceType: "document",
  });
  revalidatePath("/documents");
  return { data: doc.$id, publicLink: publicUrl !== null };
}

export async function updateDocumentMetadata(
  id: string,
  values: DocumentMetadataFormValues
): Promise<{ data: string } | { error: string }> {
  const ctx = await requireAuth();
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

  if (
    validated.data.scope === "national" &&
    !ctx.roles.includes("globaladmin")
  ) {
    return { error: "Only global admins can manage national documents" };
  }

  // Authorize both the persisted scope and the requested scope so ownership
  // transfers require access on each side.
  const persisted = getContentOwnership(doc, { legacyFallback: true });
  assertWriteAccess(ctx, persisted.campus, persisted.department);
  await assertContentOwnership(db, ctx, {
    allowGlobalCampus: validated.data.scope === "national",
    campusId: validated.data.campus_id ?? null,
    departmentId: validated.data.department_id ?? null,
  });
  if (doc.status === "published" || validated.data.status === "published") {
    assertPublishAccess(ctx, persisted.campus, persisted.department);
    assertPublishAccess(
      ctx,
      validated.data.campus_id ?? null,
      validated.data.department_id ?? null
    );
  }

  await db.updateRow("app", "documents", id, {
    title: validated.data.title,
    description: validated.data.description ?? null,
    category: validated.data.category as DocumentsCategory,
    scope: validated.data.scope as DocumentsScope,
    campus: validated.data.campus_id ?? null,
    campus_id: validated.data.campus_id ?? null,
    department: validated.data.department_id ?? null,
    language: validated.data.language,
    status: validated.data.status as DocumentsStatus,
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
  | { data: string; version: string; error?: never; sharePointError?: never }
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
    return { error: "Document not found", sharePointError: false };
  }

  const versionOwnership = getContentOwnership(doc, { legacyFallback: true });
  assertWriteAccess(ctx, versionOwnership.campus, versionOwnership.department);

  const parsedInput = documentVersionSchema.safeParse(versionInput);
  const version = parsedInput.success
    ? parseDocumentVersion(parsedInput.data)
    : null;
  if (!version) {
    return {
      error: "Version must be a number like 12 or 7.1",
      sharePointError: false,
    };
  }

  const latest = latestKnownVersion(doc, await listVersionRows(db, id));
  if (latest && compareDocumentVersions(version, latest) <= 0) {
    return {
      error: `Version must be higher than the current v${formatDocumentVersion(latest)}`,
      sharePointError: false,
    };
  }

  const fileCheck = validateDocumentFile(formData);
  if (!fileCheck.ok) {
    return { error: fileCheck.error, sharePointError: false };
  }
  const buffer = Buffer.from(await fileCheck.file.arrayBuffer());
  const campusName = await resolveCampusNameForPath(
    db,
    doc.scope,
    doc.campus_id
  );
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

  await recordVersion(db, {
    documentId: id,
    file: published.archived,
    userId: ctx.userId,
    version,
  });
  // sharepoint_web_url is left alone: the current item, and so its public
  // link, did not change.
  await db.updateRow("app", "documents", id, {
    version: versionLabel,
    version_number: version.major,
    file_size: published.current.size,
    updated_by: ctx.userId,
  });

  await logAuditEvent(ctx, "document.version_upload", {
    resourceId: id,
    resourceType: "document",
    payload: { version: versionLabel },
  });
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { data: id, version: versionLabel };
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
  const rows = await listVersionRows(db, id);
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
  assertWriteAccess(ctx, ownership.campus, ownership.department);

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
