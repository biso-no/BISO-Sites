import "server-only";

import { traceAiCall } from "@repo/observability/ai";
import {
  type RecruitmentAiEmailDraft,
  recruitmentAiEmailDraftSchema,
} from "@repo/shared/types/recruitment";
import { generateObject } from "ai";
import { MODEL_IDS, resolveModel } from "../models";
import {
  buildCandidateEmailPrompt,
  type DraftCandidateEmailInput,
  RECRUITMENT_EMAIL_SYSTEM_PROMPT,
} from "./recruitment-email-prompt";

export type {
  DraftCandidateEmailInput,
  RecruitmentEmailStage,
} from "./recruitment-email-prompt";

/**
 * Drafts a candidate email. The model never sees the candidate's name: the
 * prompt carries `[Candidate]` and the caller puts the first name back.
 */
export async function draftCandidateEmail(
  input: DraftCandidateEmailInput
): Promise<RecruitmentAiEmailDraft> {
  const model = resolveModel(input.model ?? MODEL_IDS.fast);
  const result = await traceAiCall(
    {
      functionId: "ai.recruitment-email",
      model,
      operation: "generate_object",
    },
    () =>
      generateObject({
        model,
        prompt: buildCandidateEmailPrompt(input),
        schema: recruitmentAiEmailDraftSchema,
        instructions: RECRUITMENT_EMAIL_SYSTEM_PROMPT,
        reasoning: "low",
        // Provider-side retention follows the Anthropic account's data settings,
        // not a per-request option.
      })
  );
  return result.object;
}
