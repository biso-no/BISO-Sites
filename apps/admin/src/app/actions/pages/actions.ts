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
import { canWriteDocument, isGlobalAdmin } from "@/lib/authorization";
import type { CreateManagedPageInput, UpdateManagedPageInput } from "./types";
import { ADMIN_LIST_PATH, cloneDocument, revalidateForPage } from "./utils";

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
  return await getPageById(pageId);
}

export async function createManagedPage(input: CreateManagedPageInput) {
  const payload: UpsertPageInput = {
    slug: input.slug,
    title: input.title,
    status: input.status ?? PageStatus.DRAFT,
    visibility: input.visibility ?? PageVisibility.PUBLIC,
    template: input.template,
    campusId: input.campusId,
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

  const page = await upsertPage(payload);
  revalidateForPage(page);
  return page;
}

export async function updateManagedPage(input: UpdateManagedPageInput) {
  const existing = await getPageById(input.pageId);
  const updated = await updatePage(input);

  if (existing?.slug && existing.slug !== updated.slug) {
    revalidatePath(`/${existing.slug}`);
  }

  revalidateForPage(updated);
  return updated;
}

export async function deleteManagedPage(pageId: string) {
  const { db } = await createSessionClient();
  await db.deleteRow("app", "pages", pageId);

  revalidatePath(ADMIN_LIST_PATH);
}

export async function upsertManagedPage(input: UpsertPageInput) {
  const page = await upsertPage(input);
  revalidateForPage(page);
  return page;
}
