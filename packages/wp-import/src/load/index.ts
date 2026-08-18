import {
  buildJobPermissions,
  buildPublicContentPermissions,
} from "../permissions";
import type { ContentLocale } from "../types";

export interface TranslationPayload {
  $permissions: string[];
  content_id: string;
  content_type: string;
  description: string;
  locale: ContentLocale;
  short_description: string | null;
  title: string;
}

export interface LocaleContent {
  description: string;
  locale: ContentLocale;
  shortDescription: string | null;
  title: string;
}

export function buildTranslationRows(input: {
  contentId: string;
  contentType: string;
  permissions: string[];
  source: LocaleContent;
  target: LocaleContent | null;
}): TranslationPayload[] {
  // Task 11 truncates the *source* text to the schema limits before
  // translation, but AI-translated target text is never re-checked and
  // translation frequently lengthens Norwegian into English. Re-truncate
  // both locales here so this protects every caller, not just the ones that
  // remember to do it themselves.
  const toRow = (content: LocaleContent): TranslationPayload => ({
    $permissions: input.permissions,
    content_id: input.contentId,
    content_type: input.contentType,
    description: content.description.slice(0, 8000),
    locale: content.locale,
    short_description: content.shortDescription?.slice(0, 500) ?? null,
    title: content.title.slice(0, 500),
  });

  return input.target
    ? [toRow(input.source), toRow(input.target)]
    : [toRow(input.source)];
}

/**
 * db.upsertRow validates as a full-document replace, so every required column
 * must be present on every write — a partial payload fails with
 * "Missing required attribute".
 */
export function buildJobUpsert(
  job: { row: Record<string, unknown>; rowId: string },
  translations: TranslationPayload[]
): Record<string, unknown> {
  const status = String(job.row.status ?? "draft");
  return {
    ...job.row,
    $permissions: buildJobPermissions(status),
    translations,
  };
}

export function buildProductUpsert(
  product: { row: Record<string, unknown>; rowId: string },
  translations: TranslationPayload[]
): Record<string, unknown> {
  const status = String(product.row.status ?? "draft");
  return {
    ...product.row,
    $permissions: buildPublicContentPermissions(status),
    translation_refs: translations,
  };
}
