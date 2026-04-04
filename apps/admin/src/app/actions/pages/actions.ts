"use server";

import {
  getPageById,
  type ListPagesParams,
  listPages,
  type UpsertPageInput,
  updatePage,
  upsertPage,
} from "@repo/api/page-builder";
import { createSessionClient } from "@repo/api/server";
import { PageStatus, PageVisibility } from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import {
  canWriteDocument,
  getUserAuthContext,
  isGlobalAdmin,
} from "@/lib/authorization";
import { getCampusManagementTeamId } from "@/lib/campus-constants";
import { buildPagePermissions } from "@/lib/permissions";
import type { CreateManagedPageInput, UpdateManagedPageInput } from "./types";
import { ADMIN_LIST_PATH, cloneDocument, revalidateForPage } from "./utils";

function sanitizeSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: role-based permission logic with multiple branches
async function applyUserPageScope(
  input: UpsertPageInput
): Promise<UpsertPageInput> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    return input;
  }

  const isGlobal = ctx.roles.includes("globaladmin");
  const isCampus = ctx.roles.includes("campusadmin");
  const isDepartmentUser =
    ctx.departmentTeamIds.length > 0 && !isGlobal && !isCampus;

  if (isDepartmentUser) {
    const departmentName = ctx.departmentNames[0] ?? null;
    const departmentTeamId = ctx.departmentTeamIds[0] ?? null;
    const enforcedSlug = departmentName
      ? sanitizeSlug(departmentName)
      : input.slug;

    let enforcedPageId = input.pageId;
    if (!enforcedPageId && departmentName) {
      const existing = await listPages({
        useSession: true,
        departmentId: departmentName,
        limit: 1,
      });
      if (existing.length > 0) {
        enforcedPageId = existing[0]!.id;
      }
    }

    const campusManagementTeamId = input.campusId
      ? getCampusManagementTeamId(input.campusId)
      : null;

    return {
      ...input,
      pageId: enforcedPageId,
      slug: enforcedSlug,
      departmentId: departmentName ?? input.departmentId ?? null,
      permissions: buildPagePermissions({
        departmentTeamId,
        campusManagementTeamId,
      }),
    };
  }

  if (isCampus) {
    const departmentTeamId = ctx.departmentTeamIds[0] ?? null;
    const campusManagementTeamId = input.campusId
      ? getCampusManagementTeamId(input.campusId)
      : null;
    return {
      ...input,
      permissions:
        input.permissions ??
        buildPagePermissions({ departmentTeamId, campusManagementTeamId }),
    };
  }

  if (isGlobal && !input.permissions) {
    const campusManagementTeamId = input.campusId
      ? getCampusManagementTeamId(input.campusId)
      : null;
    const departmentTeamId = ctx.departmentTeamIds[0] ?? null;
    return {
      ...input,
      permissions: buildPagePermissions({
        departmentTeamId,
        campusManagementTeamId,
      }),
    };
  }

  return input;
}

/**
 * List pages that the current user has write access to.
 * Uses session client to respect RLS and filters by $permissions.
 */
export async function listManagedPages(
  params?: Omit<ListPagesParams, "useSession">
) {
  // Fetch pages using session client (respects RLS)
  const pages = await listPages({
    ...params,
    useSession: true,
  });

  // Global admins see all pages
  if (await isGlobalAdmin()) {
    return pages;
  }

  // Filter to only pages the user can write to
  const writeablePages = await Promise.all(
    pages.map(async (page) => ({
      page,
      canWrite: await canWriteDocument(page.permissions),
    }))
  );

  return writeablePages.filter((p) => p.canWrite).map((p) => p.page);
}

export async function getManagedPage(pageId: string) {
  const page = await getPageById(pageId);
  if (!page) {
    return null;
  }

  if (await isGlobalAdmin()) {
    return page;
  }

  return (await canWriteDocument(page.permissions)) ? page : null;
}

async function createManagedPage(input: CreateManagedPageInput) {
  const payload: UpsertPageInput = {
    slug: input.slug,
    title: input.title,
    status: input.status ?? PageStatus.DRAFT,
    visibility: input.visibility ?? PageVisibility.PUBLIC,
    template: input.template,
    campusId: input.campusId,
    departmentId: input.departmentId,
    translations: input.translations.map((translation) => ({
      locale: translation.locale,
      title: translation.title ?? input.title,
      slug: null,
      description: translation.description ?? null,
      draftDocument: cloneDocument(translation.draftDocument) ?? {
        root: { props: {} },
        content: [],
      },
      publish: translation.publish ?? false,
    })),
  };

  const page = await upsertPage(await applyUserPageScope(payload));
  revalidateForPage(page);
  return page;
}

async function updateManagedPage(input: UpdateManagedPageInput) {
  const existing = await getPageById(input.pageId);
  if (!existing) {
    throw new Error("Page not found");
  }

  if (
    !((await isGlobalAdmin()) || (await canWriteDocument(existing.permissions)))
  ) {
    throw new Error("Unauthorized");
  }

  const updated = await updatePage(input);

  if (existing?.slug && existing.slug !== updated.slug) {
    revalidatePath(`/${existing.slug}`);
  }

  revalidateForPage(updated);
  return updated;
}

export async function deleteManagedPage(pageId: string) {
  const existing = await getPageById(pageId);
  if (!existing) {
    throw new Error("Page not found");
  }

  if (
    !((await isGlobalAdmin()) || (await canWriteDocument(existing.permissions)))
  ) {
    throw new Error("Unauthorized");
  }

  const { db } = await createSessionClient();
  await db.deleteRow("app", "pages", pageId);

  revalidatePath(ADMIN_LIST_PATH);
}

export async function upsertManagedPage(input: UpsertPageInput) {
  if (input.pageId) {
    const existing = await getPageById(input.pageId);
    if (!existing) {
      throw new Error("Page not found");
    }

    if (
      !(
        (await isGlobalAdmin()) ||
        (await canWriteDocument(existing.permissions))
      )
    ) {
      throw new Error("Unauthorized");
    }
  }

  const page = await upsertPage(await applyUserPageScope(input));
  revalidateForPage(page);
  return page;
}
