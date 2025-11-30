"use server";

import {
  type CreatePageInput,
  createPage,
  ensurePageTranslation,
  getPageById,
  listPages,
  publishPageTranslation,
  updatePage,
  updatePageTranslationDraft,
} from "@repo/api/page-builder";
import { createSessionClient } from "@repo/api/server";
import { revalidatePath } from "next/cache";
import { PageStatus } from "@repo/api/types/appwrite";
import type {
  CreateManagedPageInput,
  EnsureTranslationInput,
  PublishPageInput,
  SavePageDraftInput,
  SaveTranslatedPageInput,
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
  const payload: CreatePageInput = {
    slug: input.slug,
    title: input.title,
    status: input.status,
    visibility: input.visibility,
    template: input.template,
    campusId: input.campusId,
    translations: input.translations.map((translation) => ({
      locale: translation.locale,
      title: translation.title ?? input.title,
      description: translation.description ?? null,
      draftDocument: cloneDocument(translation.draftDocument),
      publish: translation.publish ?? false,
    })),
  };

  const page = await createPage(payload);
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

export async function savePageDraft(input: SavePageDraftInput) {
  const updatedDraft = await updatePageTranslationDraft({
    translationId: input.translationId,
    title: input.title,
    slug: input.slug,
    description: input.description,
    draftDocument: cloneDocument(input.draftDocument),
  });

  const page = await getPageById(updatedDraft.pageId);

  if (page) {
    revalidateForPage(page);
  }

  return updatedDraft;
}

export async function publishPage(input: PublishPageInput) {
  const translation = await publishPageTranslation({
    translationId: input.translationId,
    document: cloneDocument(input.document),
    title: input.title,
    slug: input.slug,
    description: input.description,
    pageStatus: input.pageStatus ?? PageStatus.PUBLISHED,
  });

  const page = await getPageById(translation.pageId);

  if (page) {
    revalidateForPage(page);
  }

  return translation;
}

export async function deletePage(pageId: string) {
  const { db } = await createSessionClient();
  await db.deleteRow("app", "pages", pageId);

  revalidatePath(ADMIN_LIST_PATH);
}

export async function ensureTranslation(input: EnsureTranslationInput) {
  const translation = await ensurePageTranslation(input);
  const page = await getPageById(input.pageId);

  if (page) {
    console.log("Revalidating page", page);
  }

  return translation;
}

export async function saveTranslatedPage(input: SaveTranslatedPageInput) {
  const translation = await ensurePageTranslation({
    pageId: input.pageId,
    locale: input.targetLocale,
    title: input.translatedTitle,
    sourceTranslationId: input.sourceTranslationId,
  });

  const updated = await updatePageTranslationDraft({
    translationId: translation.id,
    title: input.translatedTitle,
    slug: input.translatedSlug,
    description: input.translatedDescription,
    draftDocument: cloneDocument(input.translatedData),
  });

  const page = await getPageById(input.pageId);

  if (page) {
    revalidateForPage(page);
  }

  return {
    translation: updated,
    redirectUrl: `/admin/pages/${input.pageId}/${input.targetLocale}/editor`,
  };
}
