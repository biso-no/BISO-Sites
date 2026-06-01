import { openai } from "@ai-sdk/openai";
import type { LanguageModelV2 } from "ai";

/**
 * Chat model — used for reasoning, tool calls, and conversation.
 * Multi-step capable; consistent with the model already used in the admin
 * assistant route and content generation actions.
 */
export const chatModel: LanguageModelV2 = openai("gpt-5");

/**
 * Draft model — used for structured bilingual content generation.
 * Cheaper / faster; consistent with jobs.ts, events.ts AI actions.
 */
export const draftModel: LanguageModelV2 = openai("gpt-5-nano");
