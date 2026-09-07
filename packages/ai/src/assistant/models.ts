import type { LanguageModel } from "ai";
import { balancedModel, fastModel } from "../models";

/**
 * Chat model — used for reasoning, tool calls, and conversation.
 * Multi-step capable; the assistant runs a 12-step tool loop, so it gets the
 * balanced tier.
 */
export const chatModel: LanguageModel = balancedModel;

/**
 * Draft model — used for structured bilingual content generation.
 * Cheaper / faster; consistent with jobs.ts, events.ts AI actions.
 */
export const draftModel: LanguageModel = fastModel;
