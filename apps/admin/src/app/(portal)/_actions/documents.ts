"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
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
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import {
  resolveDocumentsDriveId,
  resolveFolderPath,
} from "@/lib/documents/sharepoint-mapping";
import {
  applyScopeQueries,
  assertPublishAccess,
  assertWriteAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import {
  DOCUMENTS_PAGE_SIZE,
  type DocumentCreateFormValues,
  type DocumentMetadataFormValues,
  documentCreateSchema,
  documentMetadataSchema,
} from "./schemas";

async function requireAuth(): Promise<UserAuthContext> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  return ctx;
}

function getSharePointService() {
  return new SharePointService(getSharePointConfig());
}

function getDocumentCreateAccessError(
  ctx: UserAuthContext,
  data: DocumentCreateFormValues
): string | null {
  if (data.scope === "national" && !ctx.roles.includes("globaladmin")) {
    return "Only global admins can create national documents";
  }

  try {
    assertWriteAccess(ctx, data.campus_id ?? null);
    if (data.status === "published") {
      assertPublishAccess(ctx, data.campus_id ?? null);
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Document access denied";
  }
}

export async function listDocuments(opts?: { status?: string; page?: number }) {
  const ctx = await requireAuth();
  const { db } = await createSessionClient();
  const page = Math.max(1, opts?.page ?? 1);

  const queries: string[] = [
    Query.orderAsc("sort_order"),
    Query.orderDesc("$updatedAt"),
    Query.limit(DOCUMENTS_PAGE_SIZE),
    Query.offset((page - 1) * DOCUMENTS_PAGE_SIZE),
    ...applyScopeQueries(ctx),
  ];

  if (opts?.status && opts.status !== "all") {
    queries.push(Query.equal("status", opts.status));
  }

  const response = await db.listRows<Documents>("app", "documents", queries);
  return { rows: response.rows, total: response.total };
}

export async function getDocument(id: string) {
  await requireAuth();
  const { db } = await createSessionClient();

  const response = await db.listRows<Documents>("app", "documents", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  return response.rows[0] ?? null;
}

export async function createDocument(
  metadata: DocumentCreateFormValues,
  formData: FormData
): Promise<
  | { data: string; error?: never; sharePointError?: never }
  | { error: string; sharePointError: boolean; data?: never }
> {
  const ctx = await requireAuth();
  const validated = documentCreateSchema.safeParse(metadata);
  if (!validated.success) {
    return { error: "Invalid form data", sharePointError: false };
  }

  const { campus_id, scope, category, language } = validated.data;

  const accessError = getDocumentCreateAccessError(ctx, validated.data);
  if (accessError) {
    return {
      error: accessError,
      sharePointError: false,
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "A PDF file is required", sharePointError: false };
  }
  if (file.type !== "application/pdf") {
    return { error: "Only PDF files are allowed", sharePointError: false };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { error: "File must be under 50 MB", sharePointError: false };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Resolve campus name for subfolder path (used by campus-bylaws)
  let campusName: string | null = null;
  if (scope === "campus" && campus_id) {
    const { db: dbForCampus } = await createSessionClient();
    const campusRows = await dbForCampus.listRows<Campus>("app", "campus", [
      Query.equal("$id", campus_id),
      Query.limit(1),
    ]);
    campusName = campusRows.rows[0]?.name ?? null;
  }

  // Auto-resolve SharePoint drive ID and folder path
  const sp = getSharePointService();
  let driveId: string;
  try {
    driveId = await resolveDocumentsDriveId(sp);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Could not resolve SharePoint drive: ${message}`,
      sharePointError: true,
    };
  }

  const folderPath = resolveFolderPath(
    category as DocumentsCategory,
    language,
    campusName
  );

  let spResult: Awaited<ReturnType<SharePointService["uploadNewFile"]>>;
  try {
    spResult = await sp.uploadNewFile(driveId, folderPath, file.name, buffer);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `SharePoint upload failed: ${message}`,
      sharePointError: true,
    };
  }

  const { db } = await createSessionClient();
  const doc = await db.upsertRow<Documents>("app", "documents", "unique()", {
    title: validated.data.title,
    description: validated.data.description ?? null,
    category: validated.data.category as DocumentsCategory,
    scope: validated.data.scope as DocumentsScope,
    campus_id: campus_id ?? null,
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

  const { db } = await createSessionClient();
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

  assertWriteAccess(ctx, doc.campus_id);
  if (doc.status === "published" || validated.data.status === "published") {
    assertPublishAccess(ctx, doc.campus_id);
    assertPublishAccess(ctx, validated.data.campus_id ?? null);
  }

  await db.updateRow("app", "documents", id, {
    title: validated.data.title,
    description: validated.data.description ?? null,
    category: validated.data.category as DocumentsCategory,
    scope: validated.data.scope as DocumentsScope,
    campus_id: validated.data.campus_id ?? null,
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
  const { db } = await createSessionClient();

  const existing = await db.listRows<Documents>("app", "documents", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const doc = existing.rows[0];
  if (!doc) {
    return { error: "Document not found", sharePointError: false };
  }

  assertWriteAccess(ctx, doc.campus_id);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "A PDF file is required", sharePointError: false };
  }
  if (file.type !== "application/pdf") {
    return { error: "Only PDF files are allowed", sharePointError: false };
  }
  if (file.size > 50 * 1024 * 1024) {
    return { error: "File must be under 50 MB", sharePointError: false };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

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
  const { db } = await createSessionClient();

  const existing = await db.listRows<Documents>("app", "documents", [
    Query.equal("$id", id),
    Query.limit(1),
  ]);
  const doc = existing.rows[0];
  if (!doc) {
    return { error: "Document not found" };
  }

  assertWriteAccess(ctx, doc.campus_id);

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

export async function listCampusesForDocuments() {
  const { db } = await createSessionClient();
  const response = await db.listRows<Campus>("app", "campus", [
    Query.orderAsc("name"),
    Query.limit(50),
  ]);
  return response.rows;
}
