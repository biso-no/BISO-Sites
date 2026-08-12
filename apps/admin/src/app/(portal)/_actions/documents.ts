"use server";

import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type {
  Campus,
  Documents,
  DocumentsCategory,
  DocumentsLanguage,
  DocumentsScope,
  DocumentsStatus,
} from "@repo/api/types/appwrite";
import {
  getSharePointConfig,
  SharePointService,
} from "@repo/connectors/sharepoint";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/authorization";
import {
  applyContentRelationshipScopeQueries,
  assertContentOwnership,
  getContentOwnership,
} from "@/lib/content-authorization";
import {
  resolveDocumentsDriveId,
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
  type DocumentMetadataFormValues,
  documentMetadataSchema,
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

type SharePointUploadOutcome =
  | { error: string; ok: false }
  | {
      ok: true;
      spResult: Awaited<ReturnType<SharePointService["uploadNewFile"]>>;
    };

async function uploadDocumentToSharePoint(input: {
  buffer: Buffer;
  campusName: string | null;
  category: DocumentsCategory;
  fileName: string;
  language: DocumentsLanguage;
}): Promise<SharePointUploadOutcome> {
  const sp = getSharePointService();
  let driveId: string;
  try {
    driveId = await resolveDocumentsDriveId(sp);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Could not resolve SharePoint drive: ${message}`,
      ok: false,
    };
  }

  const folderPath = resolveFolderPath(
    input.category,
    input.language,
    input.campusName
  );

  try {
    return {
      ok: true,
      spResult: await sp.uploadNewFile(
        driveId,
        folderPath,
        input.fileName,
        input.buffer
      ),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `SharePoint upload failed: ${message}`, ok: false };
  }
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
    Query.orderAsc("sort_order"),
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

export async function createDocument(
  metadata: DocumentMetadataFormValues,
  formData: FormData
): Promise<
  | { data: string; error?: never; sharePointError?: never }
  | { error: string; sharePointError: boolean; data?: never }
> {
  const ctx = await requireAuth();
  const validated = documentMetadataSchema.safeParse(metadata);
  if (!validated.success) {
    return { error: "Invalid form data", sharePointError: false };
  }

  const { campus_id, scope, category, language } = validated.data;

  if (scope === "national" && !ctx.roles.includes("globaladmin")) {
    return {
      error: "Only global admins can create national documents",
      sharePointError: false,
    };
  }

  const { db } = await createAdminClient();
  try {
    // National documents may keep a null campus (global admins only); campus
    // documents require a campus, and department authors their own department.
    await assertContentOwnership(db, ctx, {
      allowGlobalCampus: scope === "national",
      campusId: campus_id ?? null,
      departmentId: validated.data.department_id ?? null,
    });
    if (validated.data.status === "published") {
      assertPublishAccess(
        ctx,
        campus_id ?? null,
        validated.data.department_id ?? null
      );
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Document access denied",
      sharePointError: false,
    };
  }

  const fileCheck = validateDocumentFile(formData);
  if (!fileCheck.ok) {
    return { error: fileCheck.error, sharePointError: false };
  }
  const file = fileCheck.file;

  const buffer = Buffer.from(await file.arrayBuffer());
  const campusName = await resolveCampusNameForPath(db, scope, campus_id);

  const upload = await uploadDocumentToSharePoint({
    buffer,
    campusName,
    category: category as DocumentsCategory,
    fileName: file.name,
    language: language as DocumentsLanguage,
  });
  if (!upload.ok) {
    return { error: upload.error, sharePointError: true };
  }
  const spResult = upload.spResult;

  const doc = await db.upsertRow("app", "documents", "unique()", {
    title: validated.data.title,
    description: validated.data.description ?? null,
    category: validated.data.category as DocumentsCategory,
    scope: validated.data.scope as DocumentsScope,
    // Canonical ownership relationships; the scalar column remains as
    // migration-era compatibility metadata only.
    campus: campus_id ?? null,
    campus_id: campus_id ?? null,
    department: validated.data.department_id ?? null,
    language: language as DocumentsLanguage,
    version: validated.data.version ?? null,
    version_number: validated.data.version_number,
    sharepoint_item_id: spResult.itemId,
    sharepoint_drive_id: spResult.driveId,
    sharepoint_web_url: spResult.webUrl,
    file_size: spResult.size,
    status: validated.data.status as DocumentsStatus,
    sort_order: validated.data.sort_order,
    updated_by: ctx.userId,
  });

  await logAuditEvent(ctx, "document.create", {
    resourceId: doc.$id,
    resourceType: "document",
  });
  revalidatePath("/documents");
  return { data: doc.$id };
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
    version: validated.data.version ?? null,
    status: validated.data.status as DocumentsStatus,
    sort_order: validated.data.sort_order,
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
  formData: FormData
): Promise<
  | {
      data: string;
      newVersionNumber: number;
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
    return { error: "Document not found", sharePointError: false };
  }

  const versionOwnership = getContentOwnership(doc, { legacyFallback: true });
  assertWriteAccess(ctx, versionOwnership.campus, versionOwnership.department);

  const fileCheck = validateDocumentFile(formData);
  if (!fileCheck.ok) {
    return { error: fileCheck.error, sharePointError: false };
  }
  const buffer = Buffer.from(await fileCheck.file.arrayBuffer());

  let spResult: Awaited<ReturnType<SharePointService["replaceFileInPlace"]>>;
  try {
    const sp = getSharePointService();
    spResult = await sp.replaceFileInPlace(
      doc.sharepoint_drive_id,
      doc.sharepoint_item_id,
      buffer
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `SharePoint upload failed: ${message}`,
      sharePointError: true,
    };
  }

  const newVersionNumber = doc.version_number + 1;
  await db.updateRow("app", "documents", id, {
    version_number: newVersionNumber,
    file_size: spResult.size,
    sharepoint_web_url: spResult.webUrl,
    updated_by: ctx.userId,
  });

  await logAuditEvent(ctx, "document.version_upload", {
    resourceId: id,
    resourceType: "document",
    payload: { newVersionNumber },
  });
  revalidatePath("/documents");
  revalidatePath(`/documents/${id}`);
  return { data: id, newVersionNumber };
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

  // NOTE: We do NOT delete the file from SharePoint — the SP version history
  // is preserved intentionally. Only the Appwrite metadata row is removed.
  await db.deleteRow("app", "documents", id);

  await logAuditEvent(ctx, "document.delete", {
    resourceId: id,
    resourceType: "document",
  });
  revalidatePath("/documents");
  return { data: true };
}
