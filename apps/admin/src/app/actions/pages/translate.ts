"use server";

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { Locale } from "@repo/api/types/appwrite";

const translatedContentSchema = z.object({
  title: z.string().describe("Translated page title"),
  description: z.string().optional().describe("Translated page description"),
  content: z.array(
    z.object({
      type: z.string(),
      props: z.record(z.string(), z.unknown()),
    })
  ).describe("Translated page content blocks"),
});

type TranslatePageInput = {
  sourceLocale: Locale;
  targetLocale: Locale;
  title: string;
  description?: string;
  content: Array<{ type: string; props: Record<string, unknown> }>;
};

export async function translatePageContent(input: TranslatePageInput): Promise<{
  title: string;
  description: string;
  content: Array<{ type: string; props: Record<string, unknown> }>;
}> {
  const sourceLang = input.sourceLocale === "en" ? "English" : "Norwegian";
  const targetLang = input.targetLocale === "en" ? "English" : "Norwegian";

  const result = await generateObject({
    model: openai("gpt-5"),
    schema: translatedContentSchema,
    prompt: `You are a professional translator. Translate the following page content from ${sourceLang} to ${targetLang}.

IMPORTANT RULES:
1. Translate ALL text content (titles, descriptions, button labels, etc.) to ${targetLang}
2. Keep the exact same structure - same component types, same prop names
3. Preserve all non-text values (numbers, booleans, URLs, image paths, IDs)
4. Maintain the same tone and style in the translation
5. Do NOT translate technical values like component IDs, CSS classes, or URLs
6. Ensure the translation sounds natural in ${targetLang}

Page Title: ${input.title}
${input.description ? `Page Description: ${input.description}` : ""}

Page Content (JSON):
${JSON.stringify(input.content, null, 2)}

Return the translated content with the same structure.`,
  });

  return {
    title: result.object.title,
    description: result.object.description ?? "",
    content: result.object.content,
  };
}
