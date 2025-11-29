import { tool } from "ai";
import { z } from "zod";

const translateSchema = z.object({
  content: z.string().describe("The content to translate"),
  sourceLanguage: z
    .enum(["en", "no"])
    .describe("The language of the source content"),
  targetLanguage: z
    .enum(["en", "no"])
    .describe("The language to translate to"),
  contentType: z
    .enum(["title", "description", "short_text"])
    .describe("The type of content being translated"),
});

type TranslateInput = z.infer<typeof translateSchema>;

/**
 * Translation tool for converting content between Norwegian and English
 * This is a client-side tool that signals the need for translation
 * The actual translation happens server-side via the AI model
 */
export const translateContentTool = tool({
  description:
    "Translate content between Norwegian and English. Use this after generating content in one language to create the translation for the other language. The translation should maintain the same tone, formatting (markdown), and meaning while being natural in the target language.",
  inputSchema: translateSchema,
  execute: async (input: TranslateInput) => {
    const { content, sourceLanguage, targetLanguage, contentType } = input;
    const sourceLang = sourceLanguage === "en" ? "English" : "Norwegian";
    const targetLang = targetLanguage === "en" ? "English" : "Norwegian";

    return await Promise.resolve({
      success: true,
      action: "translate",
      originalContent: content,
      sourceLanguage,
      targetLanguage,
      contentType,
      message: `Ready to translate ${contentType} from ${sourceLang} to ${targetLang}`,
    });
  },
});
