"use server";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

export type GenerateSeoInput = {
  title: string;
  description?: string;
  /** Abbreviated page content for context (first ~8 block summaries) */
  contentSummary?: string;
};

export type GenerateSeoResult = {
  seoTitle: string;
  seoDescription: string;
};

/**
 * Generate SEO title and meta description using AI.
 * Called during publish when seoTitle or seoDescription are empty.
 *
 * Uses the same OpenAI model and pattern as /api/ai/assist.
 */
export async function generateSeoMetadata(
  input: GenerateSeoInput
): Promise<GenerateSeoResult | null> {
  const { title, description, contentSummary } = input;

  const prompt = [
    `Page title: "${title}"`,
    description ? `Description: "${description}"` : null,
    contentSummary ? `Content blocks: ${contentSummary}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: `You are an SEO specialist. Given a page's metadata and content summary, generate:
1. An SEO title: 50-60 characters, compelling, includes the main keyword
2. A meta description: 150-160 characters, summarises the page, includes a mild CTA

Reply ONLY with valid JSON in this exact shape — no markdown, no explanation:
{"seoTitle":"...","seoDescription":"..."}`,
      prompt,
      maxTokens: 200,
    });

    // Strip potential markdown code fences
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<GenerateSeoResult>;
    if (!parsed.seoTitle || !parsed.seoDescription) return null;

    return {
      seoTitle: parsed.seoTitle.trim().slice(0, 70),
      seoDescription: parsed.seoDescription.trim().slice(0, 170),
    };
  } catch {
    return null;
  }
}
