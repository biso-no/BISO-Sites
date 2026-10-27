import type { PageDoc } from "@repo/api/page-builder";
import type { ContentLocale, TranslationField } from "./content-translation";
import {
  type TranslateContentFieldsInput,
  translateContentFields,
} from "./content-translation.server";

const UUID_PATTERN = /^[a-f0-9-]{36}$/i;
const PURE_NUMBER_PATTERN = /^\d+$/;
const HTML_PATTERN = /<[a-z][\s\S]*>/i;

const TRANSLATABLE_FIELDS = new Set([
  "a",
  "address",
  "adminLabel",
  "body",
  "caption",
  "title",
  "subtitle",
  "description",
  "content",
  "ctaLabel",
  "date",
  "eyebrow",
  "label",
  "lede",
  "text",
  "heading",
  "hours",
  "imageAlt",
  "intro",
  "left",
  "paragraph",
  "paragraph1",
  "paragraph2",
  "placeholder",
  "q",
  "right",
  "titleLine1",
  "titleLine2",
  "badge",
  "heroBadge",
  "heroSubtitle",
  "tag",
  "name",
  "role",
  "bio",
  "alt",
  "feature",
  "timeline",
  "memberFeaturesHeader",
  "period",
  "savings",
  "where",
]);

const SKIP_FIELDS = new Set([
  "id",
  "type",
  "href",
  "image",
  "backgroundImage",
  "src",
  "icon",
  "iconName",
  "variant",
  "size",
  "gap",
  "align",
  "email",
  "linkedin",
  "gradient",
  "videoUrl",
  "slug",
  "price",
  "value",
  "number",
]);

type PageTranslationEntry = TranslationField & { path: string };

const isTranslatableString = (value: string): boolean => {
  const trimmed = value.trim();
  return !(
    trimmed.length <= 1 ||
    trimmed.startsWith("http") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("#") ||
    UUID_PATTERN.test(trimmed) ||
    PURE_NUMBER_PATTERN.test(trimmed)
  );
};

/**
 * A section layout is configuration and is skipped, except a Photo section's
 * alt text (`layout.backgroundImage.alt`), which visitors read.
 */
const collectLayoutAlt = (
  layout: unknown,
  path: string,
  entries: { path: string; value: string }[]
): void => {
  if (!(layout && typeof layout === "object")) {
    return;
  }
  const image = (layout as { backgroundImage?: unknown }).backgroundImage;
  if (!(image && typeof image === "object")) {
    return;
  }
  const alt = (image as { alt?: unknown }).alt;
  if (typeof alt === "string" && isTranslatableString(alt)) {
    entries.push({ path: `${path}.backgroundImage.alt`, value: alt.trim() });
  }
};

/**
 * An item's `image` is a media reference: `src`, `fileId` and `mime` stay as
 * they are, but its `alt` is read by visitors, so it is translated.
 */
const collectImageAlt = (
  image: unknown,
  path: string,
  entries: { path: string; value: string }[]
): void => {
  if (!(image && typeof image === "object")) {
    return;
  }
  const alt = (image as { alt?: unknown }).alt;
  if (typeof alt === "string" && isTranslatableString(alt)) {
    entries.push({ path: `${path}.alt`, value: alt.trim() });
  }
};

const collectTranslatableValues = (
  value: unknown,
  path: string,
  entries: { path: string; value: string }[]
): void => {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectTranslatableValues(item, `${path}[${index}]`, entries);
    }
    return;
  }
  if (!(value && typeof value === "object")) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (key === "layout") {
      collectLayoutAlt(child, childPath, entries);
      continue;
    }
    if (key === "image") {
      collectImageAlt(child, childPath, entries);
      continue;
    }
    if (SKIP_FIELDS.has(key)) {
      continue;
    }
    if (
      TRANSLATABLE_FIELDS.has(key) &&
      typeof child === "string" &&
      isTranslatableString(child)
    ) {
      entries.push({ path: childPath, value: child.trim() });
    } else if (child && typeof child === "object") {
      collectTranslatableValues(child, childPath, entries);
    }
  }
};

const getPageTranslationEntries = (
  document: PageDoc
): PageTranslationEntry[] => {
  const values: { path: string; value: string }[] = [];
  if (isTranslatableString(document.meta.title)) {
    values.push({ path: "meta.title", value: document.meta.title.trim() });
  }
  if (
    document.meta.description &&
    isTranslatableString(document.meta.description)
  ) {
    values.push({
      path: "meta.description",
      value: document.meta.description.trim(),
    });
  }
  collectTranslatableValues(document.header, "header", values);
  collectTranslatableValues(document.sections, "sections", values);

  return values.map(({ path, value }, index) => ({
    format: HTML_PATTERN.test(value) ? "html" : "plain",
    key: `field_${index}`,
    path,
    value,
  }));
};

export const getPageTranslationSource = (
  document: PageDoc
): Record<string, string> =>
  Object.fromEntries(
    getPageTranslationEntries(document).map(({ path, value }) => [path, value])
  );

const applyPageTranslations = (
  value: unknown,
  translations: ReadonlyMap<string, string>,
  path = ""
): unknown => {
  if (typeof value === "string") {
    return translations.get(path) ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      applyPageTranslations(item, translations, `${path}[${index}]`)
    );
  }
  if (!(value && typeof value === "object")) {
    return value;
  }

  const translated: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    translated[key] = applyPageTranslations(child, translations, childPath);
  }
  return translated;
};

type PageFieldTranslator = (
  input: TranslateContentFieldsInput
) => Promise<Record<string, string>>;

export const translatePageDocument = async (
  {
    document,
    sourceLocale,
    targetLocale,
  }: {
    document: PageDoc;
    sourceLocale: ContentLocale;
    targetLocale: ContentLocale;
  },
  translate: PageFieldTranslator = translateContentFields
): Promise<PageDoc> => {
  const entries = getPageTranslationEntries(document);
  if (entries.length === 0) {
    return structuredClone(document);
  }

  const translatedFields = await translate({
    contentType: "student organization page",
    fields: entries.map(({ format, key, value }) => ({ format, key, value })),
    sourceLocale,
    targetLocale,
  });
  const translationsByPath = new Map(
    entries.map(({ key, path }) => [path, translatedFields[key] ?? ""])
  );
  return applyPageTranslations(document, translationsByPath) as PageDoc;
};
