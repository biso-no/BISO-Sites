"use server";

import { Query } from "@repo/api";
import { createSessionClient } from "@repo/api/server";
import {
  type Campus,
  DocumentCategory,
  type Documents,
  DocumentScope,
  DocumentStatus,
} from "@repo/api/types/appwrite";
import {
  SharePointService,
  getSharePointConfig,
} from "@repo/connectors/sharepoint";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUserAuthContext, type UserAuthContext } from "@/lib/authorization";
import {
  applyScopeQueries,
  assertWriteAccess,
} from "@/lib/utils/authorization";
import { logAuditEvent } from "./audit-log";
import {
  DOCUMENTS_PAGE_SIZE,
  type DocumentMetadataFormValues,
  type DocumentCreateFormValues,
  documentMetadataSchema,
  documentCreateSchema,
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

  const { sharepoint_drive_id, sharepoint_folder_path, campus_id, scope } =
    validated.data;

  // National documents can only be created by global admins
  if (scope === "national" && !ctx.roles.includes("globaladmin")) {
    return { error: "Only global admins can create national documents", sharePointError: false };
  }

  assertWriteAccess(ctx, campus_id ?? null);

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

  let spResult: Awaited<ReturnType<SharePointService["uploadNewFile"]>>;
  try {
    const sp = getSharePointService();
    spResult = await sp.uploadNewFile(
      sharepoint_drive_id,
      sharepoint_folder_path,
      file.name,
      buffer
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `SharePoint upload failed: ${message}`, sharePointError: true };
  }

  const { db } = await createSessionClient();
  const doc = await db.upsertRow<Documents>("app", "documents", "unique()", {
    title: validated.data.title,
    description: validated.data.description ?? null,
    category: validated.data.category as DocumentCategory,
    scope: validated.data.scope as DocumentScope,
    campus_id: campus_id ?? null,
    version: validated.data.version ?? null,
    version_number: validated.data.version_number,
    sharepoint_item_id: spResult.itemId,
    sharepoint_drive_id: spResult.driveId,
    sharepoint_web_url: spResult.webUrl,
    file_size: spResult.size,
    status: validated.data.status as DocumentStatus,
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

  if (validated.data.scope === "national" && !ctx.roles.includes("globaladmin")) {
    return { error: "Only global admins can manage national documents" };
  }

  assertWriteAccess(ctx, doc.campus_id);

  await db.updateRow("app", "documents", id, {
    title: validated.data.title,
    description: validated.data.description ?? null,
    category: validated.data.category as DocumentCategory,
    scope: validated.data.scope as DocumentScope,
    campus_id: validated.data.campus_id ?? null,
    version: validated.data.version ?? null,
    status: validated.data.status as DocumentStatus,
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
  | { data: string; newVersionNumber: number; error?: never; sharePointError?: never }
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
    return { error: `SharePoint upload failed: ${message}`, sharePointError: true };
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

export async function listSharePointDrives(): Promise<
  Array<{ siteId: string; siteName: string; driveId: string; driveName: string }>
> {
  const ctx = await requireAuth();
  if (!ctx.roles.includes("globaladmin")) {
    return [];
  }

  try {
    const sp = getSharePointService();
    const sites = await sp.listSites();
    const drives: Array<{
      siteId: string;
      siteName: string;
      driveId: string;
      driveName: string;
    }> = [];

    // We can't call Graph directly here without the authenticated client,
    // so we'll return the sites and let the client use the site IDs.
    // For the drive picker, we list sites and pair them with a placeholder
    // driveId that the user can fill in, or we return site-level info.
    for (const site of sites) {
      drives.push({
        siteId: site.id,
        siteName: site.displayName || site.name,
        driveId: site.id, // Will be used to resolve drives on SP side
        driveName: site.displayName || site.name,
      });
    }
    return drives;
  } catch {
    return [];
  }
}

export async function listCampusesForDocuments() {
  const { db } = await createSessionClient();
  const response = await db.listRows<Campus>("app", "campus", [
    Query.orderAsc("name"),
    Query.limit(50),
  ]);
  return response.rows;
}
