import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 120;

// Regex patterns at top level for performance
const UUID_PATTERN = /^[a-f0-9-]{36}$/i;
const PURE_NUMBER_PATTERN = /^\d+$/;

interface TranslationItem {
  path: string;
  value: string;
}

interface RequestBody {
  pageData: unknown;
  sourceLocale: "no" | "en";
  targetLocale: "no" | "en";
}

/**
 * Recursively extract translatable text fields from page data
 * Identifies text fields that should be translated (title, subtitle, description, content, label, etc.)
 */
// Field names that typically contain translatable text
const TRANSLATABLE_FIELDS = new Set([
  "title",
  "subtitle",
  "description",
  "content",
  "label",
  "text",
  "heading",
  "paragraph",
  "paragraph1",
  "paragraph2",
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
]);

// Fields to skip (non-translatable)
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
  "layout",
  "size",
  "columns",
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

/**
 * Check if a string looks like translatable content
 */
function isTranslatableString(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.length <= 1) {
    return false;
  }
  if (trimmed.startsWith("http")) {
    return false;
  }
  if (trimmed.startsWith("/")) {
    return false;
  }
  if (trimmed.startsWith("#")) {
    return false;
  }
  if (UUID_PATTERN.test(trimmed)) {
    return false;
  }
  if (PURE_NUMBER_PATTERN.test(trimmed)) {
    return false;
  }
  return true;
}

/**
 * Extract translatable items from a string value
 */
function extractFromString(value: string, path: string): TranslationItem[] {
  if (isTranslatableString(value)) {
    return [{ path, value: value.trim() }];
  }
  return [];
}

/**
 * Extract translatable items from an array
 */
function extractFromArray(arr: unknown[], path: string): TranslationItem[] {
  const items: TranslationItem[] = [];
  for (const [index, item] of arr.entries()) {
    const newPath = path ? `${path}[${index}]` : `[${index}]`;
    items.push(...extractTranslatableContent(item, newPath));
  }
  return items;
}

/**
 * Extract translatable items from an object
 */
function extractFromObject(
  obj: Record<string, unknown>,
  path: string
): TranslationItem[] {
  const items: TranslationItem[] = [];

  for (const key of Object.keys(obj)) {
    if (SKIP_FIELDS.has(key)) {
      continue;
    }

    const newPath = path ? `${path}.${key}` : key;
    const value = obj[key];

    if (TRANSLATABLE_FIELDS.has(key) && typeof value === "string") {
      items.push(...extractFromString(value, newPath));
    } else if (typeof value === "object" && value !== null) {
      items.push(...extractTranslatableContent(value, newPath));
    }
  }

  return items;
}

/**
 * Recursively extract translatable text fields from page data
 */
function extractTranslatableContent(
  obj: unknown,
  path = ""
): TranslationItem[] {
  if (obj === null || obj === undefined) {
    return [];
  }

  if (typeof obj === "string") {
    return extractFromString(obj, path);
  }

  if (Array.isArray(obj)) {
    return extractFromArray(obj, path);
  }

  if (typeof obj === "object") {
    return extractFromObject(obj as Record<string, unknown>, path);
  }

  return [];
}

/**
 * Apply translations back to the page data structure
 */
function applyTranslations(
  obj: unknown,
  translations: Map<string, string>,
  path = ""
): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return translations.get(path) ?? obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => {
      const newPath = path ? `${path}[${index}]` : `[${index}]`;
      return applyTranslations(item, translations, newPath);
    });
  }

  if (typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(record)) {
      const newPath = path ? `${path}.${key}` : key;
      result[key] = applyTranslations(record[key], translations, newPath);
    }

    return result;
  }

  return obj;
}

export async function POST(req: Request) {
  const body: RequestBody = await req.json();
  const { pageData, sourceLocale, targetLocale } = body;

  const sourceLang = sourceLocale === "no" ? "Norwegian" : "English";
  const targetLang = targetLocale === "no" ? "Norwegian" : "English";
  const doc = pageData as {
    meta?: { title?: string; description?: string };
    blocks?: unknown[];
  };

  // Extract translatable content from page blocks
  const contentItems = extractTranslatableContent(doc.blocks ?? [], "blocks");

  // Add metadata fields
  const metadataItems: TranslationItem[] = [];

  if (doc.meta?.title) {
    metadataItems.push({ path: "meta.title", value: doc.meta.title });
  }

  if (doc.meta?.description) {
    metadataItems.push({
      path: "meta.description",
      value: doc.meta.description,
    });
  }

  const allItems = [...metadataItems, ...contentItems];

  if (allItems.length === 0) {
    return Response.json({
      translatedData: pageData,
      translatedDocument: pageData,
    });
  }

  // Create translation schema dynamically
  const translationSchema = z.object({
    translations: z.array(
      z.object({
        path: z.string(),
        original: z.string(),
        translated: z.string(),
      })
    ),
  });

  const prompt = `You are a professional translator specializing in ${sourceLang} to ${targetLang} translation for a student organization website.

Translate the following content items from ${sourceLang} to ${targetLang}. 
Maintain the same tone, style, and formatting (including markdown if present).
For short labels and titles, keep them concise.
For longer descriptions, ensure natural flow in the target language.
Do not translate URLs, slugs, IDs, emails, media references, variants, or layout configuration.

Content items to translate:
${allItems.map((item, i) => `${i + 1}. [${item.path}]: "${item.value}"`).join("\n")}`;

  const result = await generateObject({
    model: openai("gpt-5.1-codex"),
    schema: translationSchema,
    prompt,
  });
  // Build translations map
  const translationsMap = new Map<string, string>();
  for (const item of result.object.translations) {
    translationsMap.set(item.path, item.translated);
  }

  // Apply translations to page content
  const translatedDocument = applyTranslations(pageData, translationsMap);

  return Response.json({
    translatedDocument,
  });
}
