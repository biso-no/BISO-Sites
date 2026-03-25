import { type Models, Query } from "..";
import { createSessionClient } from "../server";
import { PageStatus } from "../types/appwrite";
import type { Locale } from "../types/appwrite";
import type {
  ContentEntryRenderRecord,
  ContentTemplateRecord,
  ContentTemplateVersionRecord,
} from "./types";
import { normalizeEntry } from "./normalizers";
import { isAuthenticatedSession } from "./normalizers";
import { attachEntryLocales, getContentEntryById } from "./entries";
import { getContentTemplateById } from "./templates";

const DATABASE_ID = "app";
const CONTENT_ENTRIES_TABLE_ID = "content_entries";

type RowRecord = Models.DefaultRow;

async function getPublishedTemplateVersion(templateId: string): Promise<{
  template: ContentTemplateRecord;
  version: ContentTemplateVersionRecord;
} | null> {
  const template = await getContentTemplateById(templateId, {
    includeVersions: true,
  });

  if (!template?.publishedVersion) {
    return null;
  }

  return {
    template,
    version: template.publishedVersion,
  };
}

export async function getRenderableContentEntryByPath({
  path,
  locale,
}: {
  path: string;
  locale: Locale;
}): Promise<ContentEntryRenderRecord | null> {
  const { db } = await createSessionClient();
  const response = await db.listRows<RowRecord>({
    databaseId: DATABASE_ID,
    tableId: CONTENT_ENTRIES_TABLE_ID,
    queries: [Query.equal("path", path), Query.limit(1)],
  });

  const row = response.rows[0];
  if (!row) {
    return null;
  }

  const entry = normalizeEntry(row);
  if (entry.status !== PageStatus.PUBLISHED) {
    return null;
  }

  if (entry.visibility === "authenticated") {
    const isAuthenticated = await isAuthenticatedSession();
    if (!isAuthenticated) {
      return null;
    }
  }

  const [enrichedEntry] = await attachEntryLocales([entry], true);
  const localeRecord =
    enrichedEntry.locales.find(
      (entryLocale) => entryLocale.locale === locale
    ) ??
    enrichedEntry.locales.find(
      (entryLocale) => entryLocale.locale === entry.sourceLocale
    ) ??
    enrichedEntry.locales[0];

  if (!localeRecord) {
    return null;
  }

  const templateRecord = await getPublishedTemplateVersion(entry.templateId);
  if (!templateRecord) {
    return null;
  }

  return {
    entry: enrichedEntry,
    locale: localeRecord,
    template: templateRecord.template,
    version: templateRecord.version,
  };
}

export async function getRenderableContentEntryById({
  entryId,
  locale,
}: {
  entryId: string;
  locale: Locale;
}): Promise<ContentEntryRenderRecord | null> {
  const entry = await getContentEntryById(entryId, {
    includeLocales: true,
  });

  if (!entry) {
    return null;
  }

  const localeRecord =
    entry.locales.find((entryLocale) => entryLocale.locale === locale) ??
    entry.locales.find(
      (entryLocale) => entryLocale.locale === entry.sourceLocale
    ) ??
    entry.locales[0];

  if (!localeRecord) {
    return null;
  }

  const template = await getPublishedTemplateVersion(entry.templateId);
  if (!template) {
    return null;
  }

  return {
    entry,
    locale: localeRecord,
    template: template.template,
    version: template.version,
  };
}
