"use server";

import {
  getPageById,
  listPages,
  updatePage,
  upsertPage,
  type UpsertPageInput,
} from "@repo/api/page-builder";
import { createSessionClient } from "@repo/api/server";
import { PageStatus, PageVisibility } from "@repo/api/types/appwrite";
import { revalidatePath } from "next/cache";
import type {
  CreateManagedPageInput,
  UpdateManagedPageInput,
} from "./types";
import { ADMIN_LIST_PATH, cloneDocument, revalidateForPage } from "./utils";

export async function listManagedPages(
  params?: Parameters<typeof listPages>[0]
) {
  return await listPages(params);
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
      draftDocument: cloneDocument(translation.draftDocument) ?? { root: { props: {} }, content: [] },
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
