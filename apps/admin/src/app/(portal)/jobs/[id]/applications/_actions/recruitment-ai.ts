"use server";

import { balancedModel, fastModel } from "@repo/ai/models";
import { createSessionClient } from "@repo/api/server";
import { getRecruitmentJobById } from "@repo/shared/recruitment";
import { generateObject } from "ai";
import { z } from "zod";
import { draftRecruitmentEmail } from "@/app/(portal)/_actions/jobs";
import { getUserAuthContext } from "@/lib/authorization";
import {
  assertRecruitmentApplicationReviewAccess,
  loadRecruitmentLookups,
  toRecruitmentAdminScope,
} from "@/lib/recruitment";
import {
  type AssistantCandidate,
  buildAssistantPrompt,
  buildComparePrompt,
  buildLabelMap,
  idsForLabels,
  restoreLabels,
} from "./recruitment-ai-prompts";

const EMAIL_STAGE_BY_INTENT: Record<
  string,
  "interview_invite" | "rejection" | "offer" | "thank_you"
> = {
  offer: "offer",
  reject: "rejection",
  schedule: "interview_invite",
  shortlist: "thank_you",
};

export interface BulkEmailDraft {
  body: string;
  error?: string;
  id: string;
  subject: string;
}

export async function draftBulkCandidateEmails(
  ids: string[],
  intent: string
): Promise<{ data?: BulkEmailDraft[]; error?: string }> {
  const stage = EMAIL_STAGE_BY_INTENT[intent] ?? "thank_you";
  try {
    const drafts = await Promise.all(
      ids.slice(0, 25).map(async (id) => {
        const result = await draftRecruitmentEmail(id, { stage });
        if (result.error || !result.data) {
          return {
            body: "",
            error: result.error ?? "No draft produced",
            id,
            subject: "",
          };
        }
        return { body: result.data.body, id, subject: result.data.subject };
      })
    );
    return { data: drafts };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to draft emails",
    };
  }
}

// ---------------------------------------------------------------------------
// Shared candidate summary contract used by the AI surfaces
// ---------------------------------------------------------------------------

export type { AssistantCandidate } from "./recruitment-ai-prompts";

async function assertJobReviewable(jobId: string): Promise<void> {
  const ctx = await getUserAuthContext();
  if (!ctx) {
    throw new Error("Unauthorized");
  }
  const { db } = await createSessionClient();
  const scope = toRecruitmentAdminScope(ctx);
  const lookups = await loadRecruitmentLookups(db);
  const vacancy = await getRecruitmentJobById(db, jobId);
  if (!vacancy) {
    throw new Error("Vacancy not found");
  }
  assertRecruitmentApplicationReviewAccess(scope, lookups, {
    campus_id: vacancy.campus_id,
    department_id: vacancy.department_id,
  });
}

// ---------------------------------------------------------------------------
// Comparison synthesis
// ---------------------------------------------------------------------------

export async function generateComparisonSynthesis(
  jobId: string,
  jobTitle: string,
  candidates: AssistantCandidate[]
): Promise<{ verdict: string; winnerId: string | null }> {
  await assertJobReviewable(jobId);
  const ranked = [...candidates].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0)
  );
  const fallbackWinner = ranked[0] ?? null;
  const heuristic = fallbackWinner
    ? `${fallbackWinner.name} leads on match score${
        fallbackWinner.strengths[0]
          ? ` thanks to ${fallbackWinner.strengths[0].toLowerCase()}`
          : ""
      }. Compare the signals below before deciding.`
    : "Not enough data to compare these candidates.";

  try {
    const { object } = await generateObject({
      model: balancedModel,
      prompt: buildComparePrompt(jobTitle, candidates),
      schema: z.object({
        verdict: z.string(),
        winnerLabel: z.string(),
      }),
      // Applicant data must not be retained on the provider's side.
      providerOptions: { openai: { store: false } },
    });
    const winner =
      idsForLabels([object.winnerLabel], buildLabelMap(candidates))[0] ?? null;
    return {
      verdict: restoreLabels(object.verdict, candidates),
      winnerId: winner ?? fallbackWinner?.id ?? null,
    };
  } catch {
    return { verdict: heuristic, winnerId: fallbackWinner?.id ?? null };
  }
}

// ---------------------------------------------------------------------------
// Conversational assistant
// ---------------------------------------------------------------------------

export interface AssistantAction {
  ids: string[];
  kind: "compare" | "email" | "schedule" | "none";
  label: string;
}

export interface AssistantReply {
  actions: AssistantAction[];
  citationIds: string[];
  reply: string;
}

export async function askRecruitmentAssistant(input: {
  jobId: string;
  jobTitle: string;
  message: string;
  candidates: AssistantCandidate[];
}): Promise<AssistantReply> {
  await assertJobReviewable(input.jobId);

  try {
    const { object } = await generateObject({
      model: fastModel,
      reasoning: "low",
      prompt: buildAssistantPrompt(
        input.jobTitle,
        input.message,
        input.candidates
      ),
      providerOptions: { openai: { store: false } },
      // Every field is required: OpenAI's strict structured outputs reject a
      // schema whose `properties` are not all listed in `required`, which is
      // what `.optional()` / `.default()` produce. Empty arrays are allowed.
      schema: z.object({
        reply: z.string(),
        citedLabels: z
          .array(z.string())
          .describe("Candidate labels cited in the reply; [] if none"),
        actions: z
          .array(
            z.object({
              kind: z.enum(["compare", "email", "schedule", "none"]),
              label: z.string(),
              candidateLabels: z
                .array(z.string())
                .describe("Relevant candidate labels; [] if none"),
            })
          )
          .describe("At most 2 follow-up actions; [] if none"),
      }),
    });

    const labelMap = buildLabelMap(input.candidates);
    return {
      actions: object.actions.map((action) => ({
        ids: idsForLabels(action.candidateLabels, labelMap),
        kind: action.kind,
        label: restoreLabels(action.label, input.candidates),
      })),
      citationIds: idsForLabels(object.citedLabels, labelMap),
      reply: restoreLabels(object.reply, input.candidates),
    };
  } catch {
    return {
      actions: [],
      citationIds: [],
      reply:
        "I couldn't reach the AI model right now (it may not be configured). You can still use the pipeline, compare, and email tools directly.",
    };
  }
}
