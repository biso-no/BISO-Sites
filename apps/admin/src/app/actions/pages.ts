"use server";

import { revalidatePath } from "next/cache";
import { PageStatus } from "@repo/api/types/appwrite";
import type { Locale, PageVisibility } from "@repo/api/types/appwrite";
import {
  createPage,
  deletePageTranslation,
  ensurePageTranslation,
  getPageById,
  getPublishedPage,
  listPages,
  publishPageTranslation,
  updatePage,
  updatePageTranslationDraft,
  type CreatePageInput,
  type PageDocument,
  type PageRecord,
  type PageTranslationRecord,
} from "@repo/api/page-builder";
import type { PageBuilderDocument } from "@repo/editor";
import { createSessionClient } from "@repo/api/server";

const ADMIN_LIST_PATH = "/admin/pages";

function cloneDocument(document: PageBuilderDocument | null | undefined): PageDocument | null {
  if (!document) {
    return null;
  }

  return JSON.parse(JSON.stringify(document)) as PageDocument;
}

function revalidateForPage(page: PageRecord) {
  revalidatePath(ADMIN_LIST_PATH);
  revalidatePath(`${ADMIN_LIST_PATH}/${page.id}`);
  if (page.slug) {
    revalidatePath(`/${page.slug}`);
  }
}

export async function listManagedPages(params?: Parameters<typeof listPages>[0]) {
  return listPages(params);
}

export async function getManagedPage(pageId: string) {
  return getPageById(pageId);
}

export interface ManagedPageTranslationInput {
  locale: Locale;
  title?: string;
  description?: string | null;
  draftDocument?: PageBuilderDocument | null;
  publish?: boolean;
}

export interface CreateManagedPageInput {
  slug: string;
  title: string;
  status?: PageStatus;
  visibility?: PageVisibility;
  template?: string | null;
  campusId?: string | null;
  translations: ManagedPageTranslationInput[];
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

export interface UpdateManagedPageInput {
  pageId: string;
  slug?: string;
  title?: string;
  status?: PageStatus;
  visibility?: PageVisibility;
  template?: string | null;
  campusId?: string | null;
}

export async function updateManagedPage(input: UpdateManagedPageInput) {
  const existing = await getPageById(input.pageId);
  const updated = await updatePage(input);

  if (existing && existing.slug && existing.slug !== updated.slug) {
    revalidatePath(`/${existing.slug}`);
  }

  revalidateForPage(updated);
  return updated;
}

export interface SavePageDraftInput {
  translationId: string;
  title?: string;
  slug?: string | null;
  description?: string | null;
  draftDocument?: PageBuilderDocument | null;
}

export async function savePageDraft(input: SavePageDraftInput) {
  return updatePageTranslationDraft({
    translationId: input.translationId,
    title: input.title,
    slug: input.slug,
    description: input.description,
    draftDocument: cloneDocument(input.draftDocument),
  });
}

export interface PublishPageInput {
  translationId: string;
  document?: PageBuilderDocument | null;
  title?: string;
  slug?: string | null;
  description?: string | null;
  pageStatus?: PageStatus;
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

async function deleteManagedTranslation(translationId: string) {
  await deletePageTranslation(translationId);
  revalidatePath(ADMIN_LIST_PATH);
}

export interface EnsureTranslationInput {
  pageId: string;
  locale: Locale;
  title?: string;
  description?: string | null;
  sourceTranslationId?: string;
}

export async function ensureTranslation(input: EnsureTranslationInput) {
  const translation = await ensurePageTranslation(input);
  const page = await getPageById(input.pageId);

  if (page) {
    console.log("Revalidating page", page);
  }

  return translation;
}

export async function getPublishedPagePreview(slug: string, locale: Locale, preview = false) {
  return getPublishedPage({ slug, locale, preview });
}
