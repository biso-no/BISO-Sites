import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * Single source of truth for the OpenAI models used across the monorepo.
 *
 * We run on the GPT-5.6 family through the OpenAI Responses API (the default
 * transport for `openai(...)` since AI SDK 5). Two tiers cover everything we do:
 *
 * - `balanced` (Terra) — the everyday tier. Use it for agentic tool loops,
 *   multi-step work, and anything where the output is a judgement a human will
 *   act on (candidate screening, receipt data that becomes a payout).
 * - `fast` (Luna) — the cheapest/fastest tier. Use it for high-volume,
 *   mechanical work with a tight schema: translation, short drafts, name
 *   matching, summaries.
 *
 * Both tiers are reasoning models. Reasoning effort defaults to `medium`; pass
 * the portable top-level `reasoning` option on a call to trade depth for
 * latency and cost. Do not mix it with `providerOptions.openai.reasoningEffort`
 * — provider options win outright and silently override it.
 */
export const MODEL_IDS = {
  balanced: "gpt-5.6-terra",
  fast: "gpt-5.6-luna",
} as const;

export type ModelTier = keyof typeof MODEL_IDS;

/** Terra — agentic tool loops, multi-step work, judgement calls. */
export const balancedModel: LanguageModel = openai(MODEL_IDS.balanced);

/** Luna — high-volume structured extraction, translation, short drafts. */
export const fastModel: LanguageModel = openai(MODEL_IDS.fast);

/** Resolve a tier name (or an explicit model id override) to a model. */
export function resolveModel(model?: ModelTier | (string & {})): LanguageModel {
  if (!model) {
    return fastModel;
  }
  if (model === "balanced") {
    return balancedModel;
  }
  if (model === "fast") {
    return fastModel;
  }
  return openai(model);
}
