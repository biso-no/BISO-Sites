import "server-only";

import {
  type ContentEntryLocaleRecord,
  type ContentEntryRecord,
  type ContentTemplateVersionRecord,
  type EditorialDocument,
  getEditorialQueryItemById,
  runEditorialQuery,
  type TemplateBinding,
  type TemplateFieldSchema,
} from "@repo/api/editorial";
import { PageRender } from "./render";

type ResolveEditorialDocumentInput = {
  entry: ContentEntryRecord;
  locale: ContentEntryLocaleRecord;
  version: ContentTemplateVersionRecord;
  viewerIsAuthenticated?: boolean;
};

function cloneDocument(document: EditorialDocument): EditorialDocument {
  return JSON.parse(JSON.stringify(document)) as EditorialDocument;
}

function isContainer(
  value: unknown
): value is Record<string, unknown> | unknown[] {
  return Array.isArray(value) || (!!value && typeof value === "object");
}

function createContainer(
  nextSegment?: string
): Record<string, unknown> | unknown[] {
  return Number.isNaN(Number(nextSegment)) ? {} : [];
}

function ensureArrayItem(
  value: unknown[],
  index: number,
  nextSegment?: string
): Record<string, unknown> | unknown[] {
  if (!isContainer(value[index])) {
    value[index] = createContainer(nextSegment);
  }

  return value[index] as Record<string, unknown> | unknown[];
}

function ensureRecordItem(
  value: Record<string, unknown>,
  key: string,
  nextSegment?: string
): Record<string, unknown> | unknown[] {
  if (!isContainer(value[key])) {
    value[key] = createContainer(nextSegment);
  }

  return value[key] as Record<string, unknown> | unknown[];
}

function setNestedValueAt(
  target: Record<string, unknown> | unknown[],
  segments: string[],
  value: unknown
): void {
  const [segment, ...rest] = segments;
  if (!segment) {
    return;
  }

  const isLastSegment = rest.length === 0;
  if (Array.isArray(target)) {
    const index = Number(segment);
    if (Number.isNaN(index)) {
      return;
    }

    if (isLastSegment) {
      target[index] = value;
      return;
    }

    setNestedValueAt(ensureArrayItem(target, index, rest[0]), rest, value);
    return;
  }

  if (isLastSegment) {
    target[segment] = value;
    return;
  }

  setNestedValueAt(ensureRecordItem(target, segment, rest[0]), rest, value);
}

function setNestedValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const segments = path.split(".").filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  setNestedValueAt(target, segments, value);
}

function readFieldValue(
  fieldId: string,
  locale: ContentEntryLocaleRecord,
  fieldSchema: TemplateFieldSchema[]
): unknown {
  if (fieldId === "title") {
    return locale.title;
  }

  if (fieldId === "description") {
    return locale.description;
  }

  const explicitValue = locale.fieldValues[fieldId];
  if (explicitValue !== undefined) {
    return explicitValue;
  }

  const schemaField = fieldSchema.find((field) => field.id === fieldId);
  return schemaField?.defaultValue;
}

function resolveContextValue(
  binding: TemplateBinding,
  entry: ContentEntryRecord,
  locale: ContentEntryLocaleRecord,
  viewerIsAuthenticated: boolean
): unknown {
  switch (binding.source.type) {
    case "context":
      switch (binding.source.key) {
        case "locale":
          return locale.locale;
        case "path":
          return entry.path;
        case "entryId":
          return entry.id;
        case "kind":
          return entry.kind;
        case "visibility":
          return entry.visibility;
        case "isAuthenticated":
          return viewerIsAuthenticated;
        default:
          return;
      }
    case "static":
      return binding.source.value;
    default:
      return;
  }
}

function applyBindingToRoot(
  document: EditorialDocument,
  binding: TemplateBinding,
  value: unknown
): boolean {
  if (binding.blockId !== "root") {
    return false;
  }

  const rootProps =
    document.root && typeof document.root.props === "object"
      ? (document.root.props as Record<string, unknown>)
      : {};

  setNestedValue(rootProps, binding.propPath, value);
  document.root = {
    ...document.root,
    props: rootProps,
  };
  return true;
}

function applyBindingToBlock(
  value: unknown,
  binding: TemplateBinding,
  resolvedValue: unknown
): boolean {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (applyBindingToBlock(item, binding, resolvedValue)) {
        return true;
      }
    }
    return false;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  const props =
    record.props && typeof record.props === "object"
      ? (record.props as Record<string, unknown>)
      : null;

  if (props?.id === binding.blockId) {
    setNestedValue(props, binding.propPath, resolvedValue);
    return true;
  }

  for (const child of Object.values(record)) {
    if (applyBindingToBlock(child, binding, resolvedValue)) {
      return true;
    }
  }

  return false;
}

type ResolveBindingValueInput = {
  binding: TemplateBinding;
  entry: ContentEntryRecord;
  locale: ContentEntryLocaleRecord;
  fieldSchema: TemplateFieldSchema[];
  viewerIsAuthenticated: boolean;
};

async function resolveBindingValue({
  binding,
  entry,
  locale,
  fieldSchema,
  viewerIsAuthenticated,
}: ResolveBindingValueInput): Promise<unknown> {
  const source = binding.source;

  switch (source.type) {
    case "field":
      return (
        readFieldValue(source.fieldId, locale, fieldSchema) ?? source.fallback
      );
    case "relation": {
      const value = readFieldValue(source.fieldId, locale, fieldSchema);

      if (source.multiple && Array.isArray(value)) {
        const related = await Promise.all(
          value.map((relationId) =>
            getEditorialQueryItemById(source.collection, String(relationId), {
              locale: locale.locale,
              viewerIsAuthenticated,
            })
          )
        );
        return related.filter(Boolean);
      }

      if (value === null || value === undefined || value === "") {
        return source.multiple ? [] : null;
      }

      return getEditorialQueryItemById(source.collection, String(value), {
        locale: locale.locale,
        viewerIsAuthenticated,
      });
    }
    case "query": {
      const items = await runEditorialQuery(source.query, {
        locale: locale.locale,
        viewerIsAuthenticated,
      });

      if (source.query.mode === "single") {
        return items[0] ?? null;
      }

      return items;
    }
    case "context":
    case "static":
      return resolveContextValue(binding, entry, locale, viewerIsAuthenticated);
    default:
      return;
  }
}

export async function resolveEditorialDocument({
  entry,
  locale,
  version,
  viewerIsAuthenticated = false,
}: ResolveEditorialDocumentInput): Promise<EditorialDocument> {
  const resolvedDocument = cloneDocument(version.layoutDocument);
  const rootProps =
    resolvedDocument.root && typeof resolvedDocument.root.props === "object"
      ? (resolvedDocument.root.props as Record<string, unknown>)
      : {};

  const resolvedRoot = {
    ...(resolvedDocument.root as Record<string, unknown>),
    props: {
      ...rootProps,
      title: locale.title,
      description: locale.description ?? undefined,
      path: entry.path ?? undefined,
      locale: locale.locale,
    },
  } as typeof resolvedDocument.root;

  resolvedDocument.root = resolvedRoot;

  for (const binding of version.bindings) {
    const value = await resolveBindingValue({
      binding,
      entry,
      locale,
      fieldSchema: version.fieldSchema,
      viewerIsAuthenticated,
    });

    if (applyBindingToRoot(resolvedDocument, binding, value)) {
      continue;
    }

    applyBindingToBlock(resolvedDocument.content, binding, value);
  }

  return resolvedDocument;
}

export async function EditorialContentView({
  entry,
  locale,
  version,
  viewerIsAuthenticated = false,
}: ResolveEditorialDocumentInput) {
  const document = await resolveEditorialDocument({
    entry,
    locale,
    version,
    viewerIsAuthenticated,
  });

  return <PageRender data={document} />;
}
