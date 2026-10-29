import "server-only";

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
  const model = input.model ?? MODEL_IDS.fast;
  const result = await generateObject({
    model: resolveModel(model),
    prompt: buildCandidateEmailPrompt(input),
    schema: recruitmentAiEmailDraftSchema,
    instructions: RECRUITMENT_EMAIL_SYSTEM_PROMPT,
    reasoning: "low",
    // Applicant data must not be retained on the provider's side beyond the call.
    providerOptions: { openai: { store: false } },
  });
  return result.object;
}
