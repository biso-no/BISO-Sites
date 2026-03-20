"use server";

import { openai } from "@ai-sdk/openai";
import {
  type ContentEntryRecord,
  type EditorialFamily,
  getContentEntryById,
  getContentTemplateById,
  listContentEntries,
  listContentTemplates,
  publishContentTemplate,
  rollbackPublishedTemplate,
  saveContentTemplateDraft,
  type TemplateFieldSchema,
  type UpsertContentEntryInput,
  type UpsertTemplateDraftInput,
  upsertContentEntry,
} from "@repo/api/editorial";
import { Locale, PageStatus, PageVisibility } from "@repo/api/types/appwrite";
import { generateObject } from "ai";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  canWriteDocument,
  getUserAuthContext,
  isGlobalAdmin,
} from "@/lib/authorization";
import {
  buildEditorialEntryPermissions,
  buildEditorialTemplatePermissions,
} from "@/lib/permissions";

type TemplateDraftInput = Omit<
  UpsertTemplateDraftInput,
  "createdBy" | "permissions"
>;

type ManagedLocaleInput = {
  locale: Locale;
  title: string;
  description?: string | null;
  fieldValues: Record<string, unknown>;
  seo?: {
    title?: string;
    description?: string;
    image?: string;
  };
  translationStatus?: "source" | "manual" | "ai" | "stale";
  translatedFromLocale?: Locale | null;
  sourceUpdatedAt?: string | null;
};

type ManagedEntryInput = {
  entryId?: string;
  kind: EditorialFamily;
  path?: string | null;
  status: PageStatus;
  visibility: PageVisibility;
  sourceLocale: Locale;
  templateId: string;
  locales: ManagedLocaleInput[];
};

function sanitizePath(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9/\\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function getDefaultFieldValue(field: TemplateFieldSchema): unknown {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  switch (field.type) {
    case "boolean":
      return false;
    case "number":
      return 0;
    case "relation":
      return field.allowMultiple ? [] : "";
    default:
      return "";
  }
}

function buildDefaultLocaleFieldValues(
  fieldSchema: TemplateFieldSchema[]
): Record<string, unknown> {
  return fieldSchema.reduce<Record<string, unknown>>((accumulator, field) => {
    accumulator[field.id] = getDefaultFieldValue(field);
    return accumulator;
  }, {});
}

function mapEntryScope(
  ctx: NonNullable<Awaited<ReturnType<typeof getUserAuthContext>>>
): {
  scope: "global" | "campus" | "department";
  campusId: string | null;
  departmentId: string | null;
} {
  const isGlobal =
    ctx.roles.includes("globaladmin") || ctx.labels.includes("admin");
  const isCampus = ctx.roles.includes("campusadmin");
  const departmentId = ctx.departmentNames[0] ?? null;
  const campusId = ctx.managedCampuses[0] ?? ctx.campusNames[0] ?? null;

  let scope: "global" | "campus" | "department" = "global";
  if (departmentId) {
    scope = "department";
  } else if (isCampus) {
    scope = "campus";
  }

  return {
    scope: isGlobal ? "global" : scope,
    campusId,
    departmentId,
  };
}

async function assertTemplateAccess() {
  if (!(await isGlobalAdmin())) {
    throw new Error("Unauthorized");
  }
}

async function assertEntryWriteAccess(entry: ContentEntryRecord) {
  if (await isGlobalAdmin()) {
    return;
  }

  if (!(await canWriteDocument(entry.permissions))) {
    throw new Error("Unauthorized");
  }
}

function revalidateContentPaths(entry?: { id: string; path: string | null }) {
  revalidatePath("/content");
  revalidatePath("/content/entries");

  if (entry?.id) {
    revalidatePath(`/content/entries/${entry.id}`);
    revalidatePath(`/content/entries/${entry.id}/preview`);
  }

  if (entry?.path) {
    revalidatePath(`/${entry.path}`);
  }
}

function applyVisibilityToPermissions(
  permissions: string[],
  visibility: PageVisibility
): string[] {
  const nextPermissions = permissions.filter(
    (permission) => !permission.startsWith('read("')
  );

  nextPermissions.unshift(
    visibility === "authenticated" ? 'read("users")' : 'read("any")'
  );

  return nextPermissions;
}

export async function listPublishedTemplateOptions() {
  const templates = await listContentTemplates({
    includeVersions: true,
    useSession: true,
  });

  return templates.filter((template) => template.publishedVersion);
}

export async function listManagedContentTemplates() {
  await assertTemplateAccess();
  return listContentTemplates({ includeVersions: true });
}

export async function getManagedContentTemplate(templateId: string) {
  await assertTemplateAccess();
  return getContentTemplateById(templateId, { includeVersions: true });
}

export async function saveManagedContentTemplateDraft(
  input: TemplateDraftInput
) {
  await assertTemplateAccess();

  const ctx = await getUserAuthContext();

  const template = await saveContentTemplateDraft({
    ...input,
    createdBy: ctx?.userId ?? null,
    permissions: buildEditorialTemplatePermissions(),
  });

  revalidatePath("/content");
  revalidatePath("/content/templates");
  revalidatePath(`/content/templates/${template.id}`);

  return template;
}

export async function publishManagedContentTemplate(templateId: string) {
  await assertTemplateAccess();
  const template = await publishContentTemplate(templateId);

  revalidatePath("/content");
  revalidatePath("/content/templates");
  revalidatePath(`/content/templates/${template.id}`);

  const entries = await listContentEntries({
    templateId,
    includeLocales: false,
  });
  for (const entry of entries) {
    revalidateContentPaths({ id: entry.id, path: entry.path });
  }

  return template;
}

export async function rollbackManagedContentTemplate(
  templateId: string,
  publishedVersionId: string
) {
  await assertTemplateAccess();
  const template = await rollbackPublishedTemplate(
    templateId,
    publishedVersionId
  );

  revalidatePath("/content");
  revalidatePath("/content/templates");
  revalidatePath(`/content/templates/${template.id}`);

  return template;
}

export async function listManagedContentEntries() {
  const entries = await listContentEntries({
    includeLocales: true,
    useSession: true,
  });

  if (await isGlobalAdmin()) {
    return entries;
  }

  const accessMatrix = await Promise.all(
    entries.map(async (entry) => ({
      entry,
      canWrite: await canWriteDocument(entry.permissions),
    }))
  );

  return accessMatrix.filter((item) => item.canWrite).map((item) => item.entry);
}

export async function getManagedContentEntry(entryId: string) {
  const entry = await getContentEntryById(entryId, { includeLocales: true });
  if (!entry) {
    return null;
  }

  await assertEntryWriteAccess(entry);
  const template = await getContentTemplateById(entry.templateId, {
    includeVersions: true,
  });

  return {
    entry,
    template,
  };
}

export async function createManagedContentEntryDraft(templateId: string) {
  const template = await getContentTemplateById(templateId, {
    includeVersions: true,
  });

  if (!template?.publishedVersion) {
    throw new Error(
      "Only published templates can be used for content entries."
    );
  }

  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }

  const scope = mapEntryScope(ctx);
  const fieldValues = buildDefaultLocaleFieldValues(
    template.publishedVersion.fieldSchema
  );

  const entry = await upsertContentEntry({
    kind: template.family,
    status: PageStatus.DRAFT,
    visibility: PageVisibility.PUBLIC,
    scope: scope.scope,
    sourceLocale: Locale.NO,
    templateId: template.id,
    campusId: scope.campusId,
    departmentId: scope.departmentId,
    createdBy: ctx.userId,
    permissions: buildEditorialEntryPermissions({
      visibility: PageVisibility.PUBLIC,
      userId: ctx.userId,
      campusTeamId: ctx.campusTeamIds[0] ?? null,
      departmentTeamId: ctx.departmentTeamIds[0] ?? null,
    }),
    locales: [
      {
        locale: Locale.NO,
        title: "",
        description: "",
        fieldValues,
        translationStatus: "source",
      },
      {
        locale: Locale.EN,
        title: "",
        description: "",
        fieldValues,
        translationStatus: "stale",
        translatedFromLocale: Locale.NO,
      },
    ],
  });

  revalidateContentPaths({ id: entry.id, path: entry.path });
  return entry;
}

export async function upsertManagedContentEntry(input: ManagedEntryInput) {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }
  const scopedContext = mapEntryScope(ctx);

  const existing = input.entryId
    ? await getContentEntryById(input.entryId, { includeLocales: true })
    : null;
  if (existing) {
    await assertEntryWriteAccess(existing);
  }

  const scope = existing ? existing.scope : scopedContext.scope;
  const campusId = existing?.campusId ?? scopedContext.campusId;
  const departmentId = existing?.departmentId ?? scopedContext.departmentId;
  const permissions = existing?.permissions
    ? applyVisibilityToPermissions(existing.permissions, input.visibility)
    : buildEditorialEntryPermissions({
        visibility: input.visibility,
        userId: ctx.userId,
        campusTeamId: ctx.campusTeamIds[0] ?? null,
        departmentTeamId: ctx.departmentTeamIds[0] ?? null,
      });

  const sanitizedPath = input.path ? sanitizePath(input.path) : null;

  const entry = await upsertContentEntry({
    entryId: input.entryId,
    kind: input.kind,
    path: sanitizedPath,
    status: input.status,
    visibility: input.visibility,
    scope,
    sourceLocale: input.sourceLocale,
    templateId: input.templateId,
    campusId,
    departmentId,
    createdBy: existing?.createdBy ?? ctx.userId,
    permissions,
    locales: input.locales.map((localeInput) => ({
      locale: localeInput.locale,
      title: localeInput.title,
      description: localeInput.description ?? null,
      fieldValues: localeInput.fieldValues,
      seo: localeInput.seo ?? {},
      translationStatus:
        localeInput.locale === input.sourceLocale
          ? "source"
          : (localeInput.translationStatus ?? "manual"),
      translatedFromLocale:
        localeInput.locale === input.sourceLocale
          ? null
          : (localeInput.translatedFromLocale ?? input.sourceLocale),
      sourceUpdatedAt:
        localeInput.locale === input.sourceLocale
          ? new Date().toISOString()
          : (localeInput.sourceUpdatedAt ?? new Date().toISOString()),
    })),
  } satisfies UpsertContentEntryInput);

  revalidateContentPaths({ id: entry.id, path: entry.path });
  return entry;
}

export async function translateManagedContentLocale(input: {
  entryId: string;
  targetLocale: Locale;
}) {
  const entry = await getContentEntryById(input.entryId, {
    includeLocales: true,
  });
  if (!entry) {
    throw new Error("Entry not found");
  }

  await assertEntryWriteAccess(entry);

  const sourceLocale =
    entry.locales.find((locale) => locale.locale === entry.sourceLocale) ??
    entry.locales[0];

  if (!sourceLocale) {
    throw new Error("No source locale content found");
  }

  const translatedSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    fieldValues: z.record(z.string(), z.unknown()),
  });

  const sourceLanguage =
    entry.sourceLocale === Locale.EN ? "English" : "Norwegian";
  const targetLanguage =
    input.targetLocale === Locale.EN ? "English" : "Norwegian";

  const result = await generateObject({
    model: openai("gpt-5-mini"),
    schema: translatedSchema,
    prompt: `Translate this editorial entry from ${sourceLanguage} to ${targetLanguage}.

Rules:
1. Translate human-facing text only.
2. Keep keys and structure exactly the same.
3. Preserve URLs, IDs, numbers, booleans, and machine values.
4. The result must be natural in ${targetLanguage}.

Entry title: ${sourceLocale.title}
Entry description: ${sourceLocale.description ?? ""}
Field values JSON:
${JSON.stringify(sourceLocale.fieldValues, null, 2)}`,
  });

  return {
    locale: input.targetLocale,
    title: result.object.title,
    description: result.object.description ?? "",
    fieldValues: result.object.fieldValues,
    translationStatus: "ai" as const,
    translatedFromLocale: entry.sourceLocale,
    sourceUpdatedAt: sourceLocale.updatedAt,
  };
}
