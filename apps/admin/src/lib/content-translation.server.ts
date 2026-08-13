import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { after } from "next/server";
import { z } from "zod";
import type {
  AutoTranslationOptions,
  ContentLocale,
  TranslationField,
} from "./content-translation";

const TRANSLATION_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export const contentLocaleSchema = z.enum(["no", "en"]);

export const autoTranslationOptionsSchema = z.object({
  enabled: z.boolean(),
  sourceLocale: contentLocaleSchema,
});

export const parseAutoTranslationOptions = (
  value: unknown
): AutoTranslationOptions | undefined => {
  const parsed = autoTranslationOptionsSchema.optional().safeParse(value);
  if (!parsed.success) {
    throw new Error("Invalid auto-translation options");
  }
  return parsed.data;
};

const LANGUAGE_NAMES: Record<ContentLocale, string> = {
  en: "English",
  no: "Norwegian Bokmål",
};

const translationResponseSchema = z.object({
  translations: z.array(
    z.object({
      key: z.string(),
      translated: z.string(),
    })
  ),
});

export interface TranslateContentFieldsInput {
  contentType: string;
  fields: TranslationField[];
  sourceLocale: ContentLocale;
  targetLocale: ContentLocale;
}

const validateFields = (fields: TranslationField[]): void => {
  const keys = new Set<string>();
  for (const field of fields) {
    if (!TRANSLATION_FIELD_KEY_PATTERN.test(field.key)) {
      throw new Error(`Invalid translation field key: ${field.key}`);
    }
    if (keys.has(field.key)) {
      throw new Error("Translation field keys must be unique");
    }
    keys.add(field.key);
  }
};

export const translateContentFields = async ({
  contentType,
  fields,
  sourceLocale,
  targetLocale,
}: TranslateContentFieldsInput): Promise<Record<string, string>> => {
  if (sourceLocale === targetLocale) {
    throw new Error("Source and target locales must differ");
  }
  validateFields(fields);

  const nonEmptyFields = fields.filter(
    (field) => field.value.trim().length > 0
  );
  const translatedFields: Record<string, string> = Object.fromEntries(
    fields.map((field) => [field.key, ""])
  );
  if (nonEmptyFields.length === 0) {
    return translatedFields;
  }

  const { object } = await generateObject({
    model: openai("gpt-5-nano"),
    prompt: `Translate this ${contentType} from ${LANGUAGE_NAMES[sourceLocale]} to ${LANGUAGE_NAMES[targetLocale]}.
Return one translation for every supplied field using the exact same key.
Preserve meaning, tone, proper nouns, URLs, email addresses, placeholders, identifiers, and HTML structure.
Do not add facts or explanatory text. Leave formatting intact.

Fields:
${JSON.stringify(nonEmptyFields)}`,
    schema: translationResponseSchema,
  });

  const requestedKeys = new Set(nonEmptyFields.map((field) => field.key));
  for (const translation of object.translations) {
    if (requestedKeys.has(translation.key)) {
      translatedFields[translation.key] = translation.translated;
    }
  }

  const missingKey = nonEmptyFields.find(
    (field) => translatedFields[field.key]?.length === 0
  )?.key;
  if (missingKey) {
    throw new Error(`Translation response omitted field: ${missingKey}`);
  }

  return translatedFields;
};

interface ScheduleContentTranslationInput {
  enabled: boolean;
  task: () => Promise<void>;
}

export const scheduleContentTranslation = ({
  enabled,
  task,
}: ScheduleContentTranslationInput): boolean => {
  if (!enabled) {
    return false;
  }

  after(async () => {
    try {
      await task();
    } catch (error) {
      console.error("[content-translation] background task failed", error);
    }
  });
  return true;
};
