import type { Data } from "@puckeditor/core";
import { ID, type Models, Permission, Query, Role } from ".";
import { createAdminClient, createSessionClient } from "./server";
import { Locale, PageStatus, type PageVisibility } from "./types/appwrite";

const DATABASE_ID = "app";
const CONTENT_TEMPLATES_TABLE_ID = "content_templates";
const CONTENT_TEMPLATE_VERSIONS_TABLE_ID = "content_template_versions";
const CONTENT_ENTRIES_TABLE_ID = "content_entries";
const CONTENT_ENTRY_LOCALES_TABLE_ID = "content_entry_locales";

export const EDITORIAL_FAMILIES = ["page", "policy", "article"] as const;
export const EDITORIAL_SCOPES = ["global", "campus", "department"] as const;
export const TEMPLATE_VERSION_STATUSES = ["draft", "published"] as const;
export const TEMPLATE_FIELD_TYPES = [
  "text",
  "textarea",
  "rich-text",
  "number",
  "boolean",
  "url",
  "image",
  "select",
  "relation",
  "date",
] as const;
export const BINDING_SOURCE_TYPES = [
  "field",
  "relation",
  "query",
  "context",
  "static",
] as const;
export const EDITORIAL_QUERY_COLLECTIONS = [
  "events",
  "news",
  "jobs",
  "products",
  "content_entries",
] as const;
export const TRANSLATION_STATUSES = [
  "source",
  "manual",
  "ai",
  "stale",
] as const;

export type EditorialDocument = Data;
export type EditorialFamily = (typeof EDITORIAL_FAMILIES)[number];
export type EditorialScope = (typeof EDITORIAL_SCOPES)[number];
export type TemplateVersionStatus = (typeof TEMPLATE_VERSION_STATUSES)[number];
export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number];
export type BindingSourceType = (typeof BINDING_SOURCE_TYPES)[number];
export type EditorialQueryCollection =
  (typeof EDITORIAL_QUERY_COLLECTIONS)[number];
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export type TemplateFieldOption = {
  label: string;
  value: string;
};

export type TemplateFieldSchema = {
  id: string;
  label: string;
  type: TemplateFieldType;
  required?: boolean;
  description?: string;
  placeholder?: string;
  localized?: boolean;
  options?: TemplateFieldOption[];
  collection?: EditorialQueryCollection;
  allowMultiple?: boolean;
  defaultValue?: unknown;
};

export type EditorialQueryFilterOperator =
  | "equal"
  | "notEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "isNull"
  | "isNotNull";

export type EditorialQueryFilter = {
  field: string;
  operator: EditorialQueryFilterOperator;
  value?: unknown;
};

export type EditorialQueryDefinition = {
  collection: EditorialQueryCollection;
  limit?: number;
  mode?: "single" | "list";
  sort?: {
    field: string;
    direction: "asc" | "desc";
  };
  filters?: EditorialQueryFilter[];
};

type FieldBindingSource = {
  type: "field";
  fieldId: string;
  fallback?: unknown;
};

type RelationBindingSource = {
  type: "relation";
  fieldId: string;
  collection: EditorialQueryCollection;
  multiple?: boolean;
};

type QueryBindingSource = {
  type: "query";
  query: EditorialQueryDefinition;
};

type ContextBindingSource = {
  type: "context";
  key:
    | "locale"
    | "path"
    | "isAuthenticated"
    | "entryId"
    | "kind"
    | "visibility";
};

type StaticBindingSource = {
  type: "static";
  value: unknown;
};

export type TemplateBindingSource =
  | FieldBindingSource
  | RelationBindingSource
  | QueryBindingSource
  | ContextBindingSource
  | StaticBindingSource;

export type TemplateBinding = {
  id: string;
  blockId: string;
  propPath: string;
  source: TemplateBindingSource;
};

export type EditorialSeo = {
  title?: string;
  description?: string;
  image?: string;
};

export type ContentTemplateVersionRecord = {
  id: string;
  templateId: string;
  version: number;
  status: TemplateVersionStatus;
  layoutDocument: EditorialDocument;
  fieldSchema: TemplateFieldSchema[];
  bindings: TemplateBinding[];
  previewSeedData: Record<string, unknown>;
  notes: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentTemplateRecord = {
  id: string;
  key: string;
  name: string;
  family: EditorialFamily;
  description: string | null;
  createdBy: string | null;
  currentDraftVersionId: string | null;
  currentPublishedVersionId: string | null;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  draftVersion?: ContentTemplateVersionRecord | null;
  publishedVersion?: ContentTemplateVersionRecord | null;
  versions?: ContentTemplateVersionRecord[];
};

export type ContentEntryLocaleRecord = {
  id: string;
  entryId: string;
  locale: Locale;
  title: string;
  description: string | null;
  fieldValues: Record<string, unknown>;
  seo: EditorialSeo;
  translationStatus: TranslationStatus;
  translatedFromLocale: Locale | null;
  sourceUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ContentEntryRecord = {
  id: string;
  kind: EditorialFamily;
  path: string | null;
  status: PageStatus;
  visibility: PageVisibility;
  scope: EditorialScope;
  sourceLocale: Locale;
  templateId: string;
  campusId: string | null;
  departmentId: string | null;
  createdBy: string | null;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  locales: ContentEntryLocaleRecord[];
};

export type ContentEntryRenderRecord = {
  entry: ContentEntryRecord;
  locale: ContentEntryLocaleRecord;
  template: ContentTemplateRecord;
  version: ContentTemplateVersionRecord;
};

export type EditorialQueryItem = {
  id: string;
  title: string;
  description?: string;
  image?: string;
  href?: string;
  date?: string;
  location?: string;
  category?: string;
  metadata?: Record<string, unknown>;
};

export type UpsertTemplateDraftInput = {
  templateId?: string;
  key: string;
  name: string;
  family: EditorialFamily;
  description?: string | null;
  createdBy?: string | null;
  layoutDocument: EditorialDocument;
  fieldSchema: TemplateFieldSchema[];
  bindings: TemplateBinding[];
  previewSeedData?: Record<string, unknown>;
  notes?: string | null;
  permissions?: string[];
};

export type UpsertContentEntryLocaleInput = {
  locale: Locale;
  title: string;
  description?: string | null;
  fieldValues: Record<string, unknown>;
  seo?: EditorialSeo;
  translationStatus?: TranslationStatus;
  translatedFromLocale?: Locale | null;
  sourceUpdatedAt?: string | null;
};

export type UpsertContentEntryInput = {
  entryId?: string;
  kind: EditorialFamily;
  path?: string | null;
  status: PageStatus;
  visibility: PageVisibility;
  scope: EditorialScope;
  sourceLocale: Locale;
  templateId: string;
  campusId?: string | null;
  departmentId?: string | null;
  createdBy?: string | null;
  permissions?: string[];
  locales: UpsertContentEntryLocaleInput[];
};

type RowRecord = Models.DefaultRow;

function cloneDocument(document: EditorialDocument): EditorialDocument {
  return JSON.parse(JSON.stringify(document)) as EditorialDocument;
}

function decodeJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  if (typeof value === "object") {
    return value as T;
  }

  return fallback;
}

function serializeJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function createEmptyDocument(): EditorialDocument {
  return {
    root: { props: {} },
    content: [],
  };
}

function normalizeTemplateVersion(
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

function normalizeTemplate(row: RowRecord): ContentTemplateRecord {
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

function normalizeEntryLocale(row: RowRecord): ContentEntryLocaleRecord {
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

function normalizeEntry(row: RowRecord): ContentEntryRecord {
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

async function isAuthenticatedSession(): Promise<boolean> {
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

async function attachTemplateVersions(
  templates: ContentTemplateRecord[],
  useSession = false
): Promise<ContentTemplateRecord[]> {
  if (templates.length === 0) {
    return templates;
  }

  const { db } = useSession
    ? await createSessionClient()
    : await createAdminClient();
  const templateIds = templates.map((template) => template.id);

  const response = await db.listRows<RowRecord>({
    databaseId: DATABASE_ID,
    tableId: CONTENT_TEMPLATE_VERSIONS_TABLE_ID,
    queries: [
      Query.equal("template_id", templateIds),
      Query.orderDesc("version"),
    ],
  });

  const versions = response.rows.map(normalizeTemplateVersion);
  const versionsByTemplate = new Map<string, ContentTemplateVersionRecord[]>();

  for (const version of versions) {
    const current = versionsByTemplate.get(version.templateId) ?? [];
    current.push(version);
    versionsByTemplate.set(version.templateId, current);
  }

  return templates.map((template) => {
    const templateVersions = versionsByTemplate.get(template.id) ?? [];
    return {
      ...template,
      versions: templateVersions,
      draftVersion:
        templateVersions.find(
          (version) => version.id === template.currentDraftVersionId
        ) ?? null,
      publishedVersion:
        templateVersions.find(
          (version) => version.id === template.currentPublishedVersionId
        ) ?? null,
    };
  });
}

async function attachEntryLocales(
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

function getRequiredFieldErrors(
  fieldSchema: TemplateFieldSchema[],
  locale: ContentEntryLocaleRecord
): string[] {
  const errors: string[] = [];

  for (const field of fieldSchema) {
    if (!field.required) {
      continue;
    }

    let value: unknown;
    if (field.id === "title") {
      value = locale.title;
    } else if (field.id === "description") {
      value = locale.description;
    } else {
      value = locale.fieldValues[field.id];
    }

    const isMissing =
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (isMissing) {
      errors.push(`${locale.locale}:${field.label}`);
    }
  }

  return errors;
}

function validateBindingReferences(
  bindings: TemplateBinding[],
  fieldSchema: TemplateFieldSchema[],
  layoutDocument: EditorialDocument
): string[] {
  const errors: string[] = [];
  const blockIds = new Set<string>();
  collectBlockIds(layoutDocument.content, blockIds);
  blockIds.add("root");

  for (const binding of bindings) {
    if (!blockIds.has(binding.blockId)) {
      errors.push(
        `Binding ${binding.id} points to missing block ${binding.blockId}`
      );
    }

    const source = binding.source;
    if (source.type === "field" || source.type === "relation") {
      const exists =
        source.fieldId === "title" ||
        source.fieldId === "description" ||
        fieldSchema.some((field) => field.id === source.fieldId);
      if (!exists) {
        errors.push(
          `Binding ${binding.id} references unknown field ${source.fieldId}`
        );
      }
    }
  }

  return errors;
}

function collectBlockIds(value: unknown, blockIds: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectBlockIds(item, blockIds);
    }
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const props =
    record.props && typeof record.props === "object"
      ? (record.props as Record<string, unknown>)
      : null;
  if (props && typeof props.id === "string") {
    blockIds.add(props.id);
  }

  for (const child of Object.values(record)) {
    collectBlockIds(child, blockIds);
  }
}

function containsUnsafeDynamicConfig(document: EditorialDocument): boolean {
  const inspect = (value: unknown): boolean => {
    if (Array.isArray(value)) {
      return value.some(inspect);
    }

    if (!value || typeof value !== "object") {
      return false;
    }

    const record = value as Record<string, unknown>;
    if (record.dataMode === "dynamic" || "dataSource" in record) {
      return true;
    }

    return Object.values(record).some(inspect);
  };

  return inspect(document.content);
}

export function validateTemplateDraft(
  draftVersion: ContentTemplateVersionRecord,
  entries: ContentEntryRecord[]
): string[] {
  const errors: string[] = [];

  if (containsUnsafeDynamicConfig(draftVersion.layoutDocument)) {
    errors.push(
      "Templates must use editorial bindings instead of Puck dynamic data sources."
    );
  }

  errors.push(
    ...validateBindingReferences(
      draftVersion.bindings,
      draftVersion.fieldSchema,
      draftVersion.layoutDocument
    )
  );

  for (const entry of entries) {
    for (const locale of entry.locales) {
      errors.push(
        ...getRequiredFieldErrors(draftVersion.fieldSchema, locale).map(
          (error) => `Entry ${entry.id} is missing ${error}`
        )
      );
    }
  }

  return errors;
}

export async function listContentTemplates({
  family,
  includeVersions = false,
  useSession = false,
}: {
  family?: EditorialFamily;
  includeVersions?: boolean;
  useSession?: boolean;
} = {}): Promise<ContentTemplateRecord[]> {
  const { db } = useSession
    ? await createSessionClient()
    : await createAdminClient();
  const queries = [Query.orderDesc("$updatedAt")];

  if (family) {
    queries.push(Query.equal("family", family));
  }

  const response = await db.listRows<RowRecord>({
    databaseId: DATABASE_ID,
    tableId: CONTENT_TEMPLATES_TABLE_ID,
    queries,
  });

  const templates = response.rows.map(normalizeTemplate);
  return includeVersions
    ? attachTemplateVersions(templates, useSession)
    : templates;
}

export async function getContentTemplateById(
  templateId: string,
  {
    includeVersions = true,
    useSession = false,
  }: { includeVersions?: boolean; useSession?: boolean } = {}
): Promise<ContentTemplateRecord | null> {
  try {
    const { db } = useSession
      ? await createSessionClient()
      : await createAdminClient();
    const row = await db.getRow<RowRecord>({
      databaseId: DATABASE_ID,
      tableId: CONTENT_TEMPLATES_TABLE_ID,
      rowId: templateId,
    });

    const template = normalizeTemplate(row);
    if (!includeVersions) {
      return template;
    }

    const [enriched] = await attachTemplateVersions([template], useSession);
    return enriched ?? null;
  } catch {
    return null;
  }
}

export async function saveContentTemplateDraft(
  input: UpsertTemplateDraftInput
): Promise<ContentTemplateRecord> {
  const { db } = await createAdminClient();
  const templateId = input.templateId ?? ID.unique();
  const existing = input.templateId
    ? await getContentTemplateById(input.templateId)
    : null;
  const previousVersions = existing?.versions ?? [];
  const nextVersionNumber =
    previousVersions.reduce(
      (maxVersion, version) => Math.max(maxVersion, version.version),
      0
    ) + 1;
  const versionId = ID.unique();

  await db.createRow({
    databaseId: DATABASE_ID,
    tableId: CONTENT_TEMPLATE_VERSIONS_TABLE_ID,
    rowId: versionId,
    data: {
      template_id: templateId,
      version: nextVersionNumber,
      status: "draft",
      layout_document: serializeJson(cloneDocument(input.layoutDocument)),
      field_schema: serializeJson(input.fieldSchema),
      bindings: serializeJson(input.bindings),
      preview_seed_data: serializeJson(input.previewSeedData ?? {}),
      notes: input.notes ?? null,
      published_at: null,
    },
    permissions: input.permissions ?? [
      Permission.read(Role.users()),
      Permission.update(Role.label("globaladmin")),
      Permission.delete(Role.label("globaladmin")),
    ],
  });

  await db.upsertRow({
    databaseId: DATABASE_ID,
    tableId: CONTENT_TEMPLATES_TABLE_ID,
    rowId: templateId,
    data: {
      key: input.key,
      name: input.name,
      family: input.family,
      description: input.description ?? null,
      created_by: existing?.createdBy ?? input.createdBy ?? null,
      current_draft_version_id: versionId,
      current_published_version_id: existing?.currentPublishedVersionId ?? null,
    },
    permissions: input.permissions ?? [
      Permission.read(Role.users()),
      Permission.update(Role.label("globaladmin")),
      Permission.delete(Role.label("globaladmin")),
    ],
  });

  return (await getContentTemplateById(templateId, {
    includeVersions: true,
  })) as ContentTemplateRecord;
}

export async function publishContentTemplate(
  templateId: string
): Promise<ContentTemplateRecord> {
  const { db } = await createAdminClient();
  const template = await getContentTemplateById(templateId, {
    includeVersions: true,
  });

  if (!template?.draftVersion) {
    throw new Error("No draft template version found to publish.");
  }

  const entries = await listContentEntries({
    templateId,
    includeLocales: true,
  });
  const errors = validateTemplateDraft(template.draftVersion, entries);

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }

  const publishedVersionNumber =
    (template.versions ?? [])
      .filter((version) => version.status === "published")
      .reduce(
        (maxVersion, version) => Math.max(maxVersion, version.version),
        0
      ) + 1;
  const publishedVersionId = ID.unique();

  await db.createRow({
    databaseId: DATABASE_ID,
    tableId: CONTENT_TEMPLATE_VERSIONS_TABLE_ID,
    rowId: publishedVersionId,
    data: {
      template_id: template.id,
      version: publishedVersionNumber,
      status: "published",
      layout_document: serializeJson(
        cloneDocument(template.draftVersion.layoutDocument)
      ),
      field_schema: serializeJson(template.draftVersion.fieldSchema),
      bindings: serializeJson(template.draftVersion.bindings),
      preview_seed_data: serializeJson(template.draftVersion.previewSeedData),
      notes: template.draftVersion.notes,
      published_at: new Date().toISOString(),
    },
    permissions: [
      Permission.read(Role.users()),
      Permission.update(Role.label("globaladmin")),
      Permission.delete(Role.label("globaladmin")),
    ],
  });

  await db.updateRow({
    databaseId: DATABASE_ID,
    tableId: CONTENT_TEMPLATES_TABLE_ID,
    rowId: template.id,
    data: {
      current_published_version_id: publishedVersionId,
    },
  });

  return (await getContentTemplateById(template.id, {
    includeVersions: true,
  })) as ContentTemplateRecord;
}

export async function rollbackPublishedTemplate(
  templateId: string,
  publishedVersionId: string
): Promise<ContentTemplateRecord> {
  const { db } = await createAdminClient();
  const template = await getContentTemplateById(templateId, {
    includeVersions: true,
  });
  const targetVersion = template?.versions?.find(
    (version) =>
      version.id === publishedVersionId && version.status === "published"
  );

  if (!(template && targetVersion)) {
    throw new Error("Published template version not found.");
  }

  await db.updateRow({
    databaseId: DATABASE_ID,
    tableId: CONTENT_TEMPLATES_TABLE_ID,
    rowId: template.id,
    data: {
      current_published_version_id: targetVersion.id,
    },
  });

  return (await getContentTemplateById(template.id, {
    includeVersions: true,
  })) as ContentTemplateRecord;
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
  kind?: EditorialFamily[];
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
