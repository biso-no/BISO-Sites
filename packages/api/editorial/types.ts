import type { Data } from "@puckeditor/core";
import { Locale, PageStatus, type PageVisibility } from "../types/appwrite";

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
