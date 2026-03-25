import { type Models, Query } from "..";
import { createAdminClient, createSessionClient } from "../server";
import { PageStatus } from "../types/appwrite";
import type {
  EditorialQueryCollection,
  EditorialQueryDefinition,
  EditorialQueryFilter,
  EditorialQueryItem,
} from "./types";
import { normalizeEntry } from "./normalizers";
import { attachEntryLocales } from "./entries";

const DATABASE_ID = "app";
const CONTENT_ENTRIES_TABLE_ID = "content_entries";

type RowRecord = Models.DefaultRow;

function buildQuery(filter: EditorialQueryFilter): string | null {
  const resolvedValue =
    filter.value === "$now" ? new Date().toISOString() : filter.value;

  switch (filter.operator) {
    case "equal":
      return Query.equal(
        filter.field,
        resolvedValue as string | number | boolean | string[]
      );
    case "notEqual":
      return Query.notEqual(
        filter.field,
        resolvedValue as string | number | boolean | string[]
      );
    case "lessThan":
      return Query.lessThan(filter.field, resolvedValue as string | number);
    case "lessThanOrEqual":
      return Query.lessThanEqual(
        filter.field,
        resolvedValue as string | number
      );
    case "greaterThan":
      return Query.greaterThan(filter.field, resolvedValue as string | number);
    case "greaterThanOrEqual":
      return Query.greaterThanEqual(
        filter.field,
        resolvedValue as string | number
      );
    case "contains":
      return Query.contains(filter.field, resolvedValue as string);
    case "startsWith":
      return Query.startsWith(filter.field, resolvedValue as string);
    case "endsWith":
      return Query.endsWith(filter.field, resolvedValue as string);
    case "isNull":
      return Query.isNull(filter.field);
    case "isNotNull":
      return Query.isNotNull(filter.field);
    default:
      return null;
  }
}

function getCollectionConfig(collection: EditorialQueryCollection): {
  tableId: string;
  statusField?: string;
} {
  switch (collection) {
    case "events":
      return { tableId: "events", statusField: "status" };
    case "news":
      return { tableId: "news", statusField: "status" };
    case "jobs":
      return { tableId: "jobs", statusField: "status" };
    case "products":
      return { tableId: "webshop_products", statusField: "status" };
    case "content_entries":
      return { tableId: CONTENT_ENTRIES_TABLE_ID, statusField: "status" };
    default:
      return { tableId: collection };
  }
}

function findTranslation(
  row: Partial<RowRecord>,
  locale?: string
): RowRecord | undefined {
  const translations = Array.isArray(row.translation_refs)
    ? (row.translation_refs as RowRecord[])
    : [];

  if (translations.length === 0) {
    return;
  }

  return (
    translations.find((translation) => translation.locale === locale) ??
    translations[0]
  );
}

function getFirstStringValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string") {
      return value;
    }
  }

  return;
}

function normalizeContentEntryQueryItem(
  row: Partial<RowRecord> & { $id: string }
): EditorialQueryItem {
  return {
    id: String(row.$id ?? ""),
    title: String(row.title ?? row.path ?? ""),
    description:
      typeof row.description === "string" ? row.description : undefined,
    href: typeof row.path === "string" ? `/${row.path}` : undefined,
    metadata: {
      kind: row.kind,
    },
  };
}

function normalizeExternalQueryItem(
  row: Partial<RowRecord> & { $id: string },
  locale?: string
): EditorialQueryItem {
  const translation = findTranslation(row, locale);
  const title =
    getFirstStringValue(translation?.title, row.title, row.name) ?? "";
  const description = getFirstStringValue(
    translation?.description,
    row.description
  );
  const hrefSource = getFirstStringValue(row.slug, row.path);
  const image = getFirstStringValue(row.image, row.image_url);
  const date = getFirstStringValue(row.start_date, row.$createdAt);

  return {
    id: String(row.$id ?? ""),
    title,
    description,
    image,
    href: hrefSource ? `/${hrefSource}` : undefined,
    date,
    location: typeof row.location === "string" ? row.location : undefined,
    category: typeof row.category === "string" ? row.category : undefined,
    metadata: {
      raw: row,
    },
  };
}

function normalizeQueryItem(
  collection: EditorialQueryCollection,
  row: Partial<RowRecord> & { $id: string },
  locale?: string
): EditorialQueryItem {
  if (collection === "content_entries") {
    return normalizeContentEntryQueryItem(row);
  }

  return normalizeExternalQueryItem(row, locale);
}

export async function runEditorialQuery(
  query: EditorialQueryDefinition,
  {
    locale,
    viewerIsAuthenticated = false,
    access = "session",
  }: {
    locale?: string;
    viewerIsAuthenticated?: boolean;
    access?: "session" | "admin";
  } = {}
): Promise<EditorialQueryItem[]> {
  const { db } =
    access === "admin"
      ? await createAdminClient()
      : await createSessionClient();
  const collectionConfig = getCollectionConfig(query.collection);
  const queries = [Query.limit(query.limit ?? 6)];

  if (collectionConfig.statusField) {
    queries.push(
      Query.equal(collectionConfig.statusField, PageStatus.PUBLISHED)
    );
  }

  if (query.collection === "content_entries" && !viewerIsAuthenticated) {
    queries.push(Query.equal("visibility", "public"));
  }

  if (query.sort) {
    queries.push(
      query.sort.direction === "desc"
        ? Query.orderDesc(query.sort.field)
        : Query.orderAsc(query.sort.field)
    );
  }

  for (const filter of query.filters ?? []) {
    const builtQuery = buildQuery(filter);
    if (builtQuery) {
      queries.push(builtQuery);
    }
  }

  if (query.collection !== "content_entries") {
    queries.push(Query.select(["*", "translation_refs.*"]));
  }

  const response = await db.listRows<RowRecord>({
    databaseId: DATABASE_ID,
    tableId: collectionConfig.tableId,
    queries,
  });

  if (query.collection === "content_entries") {
    const entries = await attachEntryLocales(
      response.rows.map(normalizeEntry),
      access === "session"
    );

    return entries.map((entry) => {
      const localeRecord =
        entry.locales.find((entryLocale) => entryLocale.locale === locale) ??
        entry.locales.find(
          (entryLocale) => entryLocale.locale === entry.sourceLocale
        ) ??
        entry.locales[0];

      return normalizeQueryItem(
        "content_entries",
        {
          $id: entry.id,
          title: localeRecord?.title ?? entry.path ?? "",
          description: localeRecord?.description ?? undefined,
          path: entry.path,
          kind: entry.kind,
        },
        locale
      );
    });
  }

  return response.rows.map((row) =>
    normalizeQueryItem(query.collection, row, locale)
  );
}

export async function getEditorialQueryItemById(
  collection: EditorialQueryCollection,
  id: string,
  {
    locale,
    viewerIsAuthenticated = false,
    access = "session",
  }: {
    locale?: string;
    viewerIsAuthenticated?: boolean;
    access?: "session" | "admin";
  } = {}
): Promise<EditorialQueryItem | null> {
  const items = await runEditorialQuery(
    {
      collection,
      limit: 1,
      mode: "single",
      filters: [{ field: "$id", operator: "equal", value: id }],
    },
    { locale, viewerIsAuthenticated, access }
  );

  return items[0] ?? null;
}
