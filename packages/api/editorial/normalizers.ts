import type { Models } from "..";
import { createSessionClient } from "../server";
import { Locale, PageStatus, type PageVisibility } from "../types/appwrite";
import type {
  ContentEntryLocaleRecord,
  ContentEntryRecord,
  ContentTemplateRecord,
  ContentTemplateVersionRecord,
  EditorialDocument,
  EditorialFamily,
  EditorialScope,
  EditorialSeo,
  TemplateBinding,
  TemplateFieldSchema,
  TemplateVersionStatus,
  TranslationStatus,
} from "./types";
import { createEmptyDocument, decodeJson } from "./utils";

type RowRecord = Models.DefaultRow;

export function normalizeTemplateVersion(
  row: RowRecord
): ContentTemplateVersionRecord {
  return {
    id: String(row.$id ?? ""),
    templateId: String(row.template_id ?? ""),
    version: Number(row.version ?? 0),
    status: (row.status as TemplateVersionStatus) ?? "draft",
    layoutDocument: decodeJson<EditorialDocument>(
      row.layout_document,
      createEmptyDocument()
    ),
    fieldSchema: decodeJson<TemplateFieldSchema[]>(row.field_schema, []),
    bindings: decodeJson<TemplateBinding[]>(row.bindings, []),
    previewSeedData: decodeJson<Record<string, unknown>>(
      row.preview_seed_data,
      {}
    ),
    notes: typeof row.notes === "string" ? row.notes : null,
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
    createdAt: String(row.$createdAt ?? ""),
    updatedAt: String(row.$updatedAt ?? ""),
  };
}

export function normalizeTemplate(row: RowRecord): ContentTemplateRecord {
  return {
    id: String(row.$id ?? ""),
    key: String(row.key ?? ""),
    name: String(row.name ?? ""),
    family: (row.family as EditorialFamily) ?? "page",
    description: typeof row.description === "string" ? row.description : null,
    createdBy: typeof row.created_by === "string" ? row.created_by : null,
    currentDraftVersionId:
      typeof row.current_draft_version_id === "string"
        ? row.current_draft_version_id
        : null,
    currentPublishedVersionId:
      typeof row.current_published_version_id === "string"
        ? row.current_published_version_id
        : null,
    permissions: Array.isArray(row.$permissions)
      ? (row.$permissions as string[])
      : [],
    createdAt: String(row.$createdAt ?? ""),
    updatedAt: String(row.$updatedAt ?? ""),
  };
}

export function normalizeEntryLocale(row: RowRecord): ContentEntryLocaleRecord {
  return {
    id: String(row.$id ?? ""),
    entryId: String(row.entry_id ?? ""),
    locale: (row.locale as Locale) ?? Locale.NO,
    title: String(row.title ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    fieldValues: decodeJson<Record<string, unknown>>(row.field_values, {}),
    seo: decodeJson<EditorialSeo>(row.seo, {}),
    translationStatus:
      (row.translation_status as TranslationStatus) ?? "manual",
    translatedFromLocale: (typeof row.translated_from_locale === "string"
      ? row.translated_from_locale
      : null) as Locale | null,
    sourceUpdatedAt:
      typeof row.source_updated_at === "string" ? row.source_updated_at : null,
    createdAt: String(row.$createdAt ?? ""),
    updatedAt: String(row.$updatedAt ?? ""),
  };
}

export function normalizeEntry(row: RowRecord): ContentEntryRecord {
  return {
    id: String(row.$id ?? ""),
    kind: (row.kind as EditorialFamily) ?? "page",
    path: typeof row.path === "string" ? row.path : null,
    status: (row.status as PageStatus) ?? PageStatus.DRAFT,
    visibility: row.visibility as PageVisibility,
    scope: (row.scope as EditorialScope) ?? "global",
    sourceLocale: (row.source_locale as Locale) ?? Locale.NO,
    templateId: String(row.template_id ?? ""),
    campusId: typeof row.campus_id === "string" ? row.campus_id : null,
    departmentId:
      typeof row.department_id === "string" ? row.department_id : null,
    createdBy: typeof row.created_by === "string" ? row.created_by : null,
    permissions: Array.isArray(row.$permissions)
      ? (row.$permissions as string[])
      : [],
    createdAt: String(row.$createdAt ?? ""),
    updatedAt: String(row.$updatedAt ?? ""),
    locales: [],
  };
}

export async function isAuthenticatedSession(): Promise<boolean> {
  try {
    const { account } = await createSessionClient();
    const user = await account.get();
    const hasEmail = typeof user.email === "string" && user.email.length > 0;
    const hasRealName =
      typeof user.name === "string" &&
      user.name.length > 0 &&
      !user.name.startsWith("guest_");

    return hasEmail || (hasRealName && !!user.emailVerification);
  } catch {
    return false;
  }
}
