import { ID, type Models, Permission, Query, Role } from "..";
import { createAdminClient, createSessionClient } from "../server";
import {
  normalizeTemplate,
  normalizeTemplateVersion,
} from "./normalizers";
import {
  type ContentEntryRecord,
  type ContentEntryLocaleRecord,
  type ContentTemplateRecord,
  type ContentTemplateVersionRecord,
  type EditorialDocument,
  type TemplateBinding,
  type TemplateFieldSchema,
  type UpsertTemplateDraftInput,
} from "./types";
import { cloneDocument, serializeJson } from "./utils";
import { listContentEntries } from "./entries";

const DATABASE_ID = "app";
const CONTENT_TEMPLATES_TABLE_ID = "content_templates";
const CONTENT_TEMPLATE_VERSIONS_TABLE_ID = "content_template_versions";

type RowRecord = Models.DefaultRow;

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
  family?: ContentTemplateRecord["family"];
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
