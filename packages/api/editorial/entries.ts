import { ID, type Models, Query } from "..";
import { createAdminClient, createSessionClient } from "../server";
import { PageStatus } from "../types/appwrite";
import type {
  ContentEntryLocaleRecord,
  ContentEntryRecord,
  UpsertContentEntryInput,
  UpsertContentEntryLocaleInput,
} from "./types";
import { normalizeEntry, normalizeEntryLocale } from "./normalizers";
import { serializeJson } from "./utils";

const DATABASE_ID = "app";
const CONTENT_ENTRIES_TABLE_ID = "content_entries";
const CONTENT_ENTRY_LOCALES_TABLE_ID = "content_entry_locales";

type RowRecord = Models.DefaultRow;

export async function attachEntryLocales(
  entries: ContentEntryRecord[],
  useSession = false
): Promise<ContentEntryRecord[]> {
  if (entries.length === 0) {
    return entries;
  }

  const { db } = useSession
    ? await createSessionClient()
    : await createAdminClient();
  const entryIds = entries.map((entry) => entry.id);
  const response = await db.listRows<RowRecord>({
    databaseId: DATABASE_ID,
    tableId: CONTENT_ENTRY_LOCALES_TABLE_ID,
    queries: [Query.equal("entry_id", entryIds)],
  });

  const locales = response.rows.map(normalizeEntryLocale);
  const localesByEntry = new Map<string, ContentEntryLocaleRecord[]>();

  for (const locale of locales) {
    const current = localesByEntry.get(locale.entryId) ?? [];
    current.push(locale);
    localesByEntry.set(locale.entryId, current);
  }

  return entries.map((entry) => ({
    ...entry,
    locales: localesByEntry.get(entry.id) ?? [],
  }));
}

export async function listContentEntries({
  includeLocales = false,
  kind,
  status,
  templateId,
  useSession = false,
  limit,
}: {
  includeLocales?: boolean;
  kind?: ContentEntryRecord["kind"][];
  status?: PageStatus[];
  templateId?: string;
  useSession?: boolean;
  limit?: number;
} = {}): Promise<ContentEntryRecord[]> {
  const { db } = useSession
    ? await createSessionClient()
    : await createAdminClient();
  const queries = [Query.orderDesc("$updatedAt")];

  if (kind?.length) {
    queries.push(Query.equal("kind", kind));
  }

  if (status?.length) {
    queries.push(Query.equal("status", status));
  }

  if (templateId) {
    queries.push(Query.equal("template_id", templateId));
  }

  if (typeof limit === "number") {
    queries.push(Query.limit(limit));
  }

  const response = await db.listRows<RowRecord>({
    databaseId: DATABASE_ID,
    tableId: CONTENT_ENTRIES_TABLE_ID,
    queries,
  });

  const entries = response.rows.map(normalizeEntry);
  return includeLocales ? attachEntryLocales(entries, useSession) : entries;
}

export async function getContentEntryById(
  entryId: string,
  {
    includeLocales = true,
    useSession = false,
  }: { includeLocales?: boolean; useSession?: boolean } = {}
): Promise<ContentEntryRecord | null> {
  try {
    const { db } = useSession
      ? await createSessionClient()
      : await createAdminClient();
    const row = await db.getRow<RowRecord>({
      databaseId: DATABASE_ID,
      tableId: CONTENT_ENTRIES_TABLE_ID,
      rowId: entryId,
    });

    const entry = normalizeEntry(row);
    if (!includeLocales) {
      return entry;
    }

    const [enriched] = await attachEntryLocales([entry], useSession);
    return enriched ?? null;
  } catch {
    return null;
  }
}

function buildEntryLocaleData(
  entryId: string,
  locale: UpsertContentEntryLocaleInput
) {
  return {
    entry_id: entryId,
    locale: locale.locale,
    title: locale.title,
    description: locale.description ?? null,
    field_values: serializeJson(locale.fieldValues),
    seo: serializeJson(locale.seo ?? {}),
    translation_status: locale.translationStatus ?? "manual",
    translated_from_locale: locale.translatedFromLocale ?? null,
    source_updated_at: locale.sourceUpdatedAt ?? null,
  };
}

function getExistingLocaleIds(
  entry: ContentEntryRecord | null
): Map<string, string> {
  const localeIds = new Map<string, string>();
  for (const locale of entry?.locales ?? []) {
    localeIds.set(locale.locale, locale.id);
  }

  return localeIds;
}

async function upsertEntryLocales({
  db,
  entryId,
  locales,
  localeIds,
  permissions,
}: {
  db: Awaited<ReturnType<typeof createAdminClient>>["db"];
  entryId: string;
  locales: UpsertContentEntryLocaleInput[];
  localeIds: Map<string, string>;
  permissions: string[] | undefined;
}) {
  for (const locale of locales) {
    const localeRowId = localeIds.get(locale.locale) ?? ID.unique();
    await db.upsertRow({
      databaseId: DATABASE_ID,
      tableId: CONTENT_ENTRY_LOCALES_TABLE_ID,
      rowId: localeRowId,
      data: buildEntryLocaleData(entryId, locale),
      permissions,
    });
  }
}

export async function upsertContentEntry(
  input: UpsertContentEntryInput
): Promise<ContentEntryRecord> {
  const { db } = await createAdminClient();
  const entryId = input.entryId ?? ID.unique();
  const existing = input.entryId
    ? await getContentEntryById(input.entryId)
    : null;
  const permissions = input.permissions ?? existing?.permissions;

  await db.upsertRow({
    databaseId: DATABASE_ID,
    tableId: CONTENT_ENTRIES_TABLE_ID,
    rowId: entryId,
    data: {
      kind: input.kind,
      path: input.path ?? null,
      status: input.status,
      visibility: input.visibility,
      scope: input.scope,
      source_locale: input.sourceLocale,
      template_id: input.templateId,
      campus_id: input.campusId ?? null,
      department_id: input.departmentId ?? null,
      created_by: existing?.createdBy ?? input.createdBy ?? null,
    },
    permissions,
  });

  await upsertEntryLocales({
    db,
    entryId,
    locales: input.locales,
    localeIds: getExistingLocaleIds(existing),
    permissions,
  });

  return (await getContentEntryById(entryId, {
    includeLocales: true,
  })) as ContentEntryRecord;
}

