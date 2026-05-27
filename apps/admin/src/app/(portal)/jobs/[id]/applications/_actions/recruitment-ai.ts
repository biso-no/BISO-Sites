"use server";

import { openai } from "@ai-sdk/openai";
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

export interface AssistantCandidate {
  days: number;
  gaps: string[];
  id: string;
  name: string;
  score: number | null;
  skills: string[];
  source: string | null;
  stage: string;
  strengths: string[];
  summary: string | null;
}

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

function describeCandidates(candidates: AssistantCandidate[]): string {
  return candidates
    .map(
      (candidate) =>
        `- ${candidate.name} | stage=${candidate.stage} | match=${
          candidate.score ?? "n/a"
        } | ${candidate.days}d in pipeline | source=${
          candidate.source ?? "unknown"
        } | strengths: ${candidate.strengths.join("; ") || "—"} | gaps: ${
          candidate.gaps.join("; ") || "—"
        }`
    )
    .join("\n");
}

function matchNamesToIds(
  names: string[],
  candidates: AssistantCandidate[]
): string[] {
  const ids: string[] = [];
  for (const name of names) {
    const lower = name.toLowerCase();
    const match = candidates.find(
      (candidate) =>
        candidate.name.toLowerCase() === lower ||
        candidate.name.toLowerCase().includes(lower) ||
        lower.includes(candidate.name.split(" ")[0].toLowerCase())
    );
    if (match && !ids.includes(match.id)) {
      ids.push(match.id);
    }
  }
  return ids;
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
      model: openai("gpt-5-nano"),
      prompt: `You are a hiring copilot comparing candidates for "${jobTitle}".
Write a 2-3 sentence verdict on who fits best and the key trade-off.
Reference candidates by first name. Pick a single winner.

Candidates:
${describeCandidates(candidates)}`,
      schema: z.object({
        verdict: z.string(),
        winnerName: z.string(),
      }),
    });
    const winner = matchNamesToIds([object.winnerName], candidates)[0] ?? null;
    return {
      verdict: object.verdict,
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
      model: openai("gpt-5-nano"),
      prompt: `You are the recruitment pipeline copilot for the vacancy "${input.jobTitle}".
Answer the recruiter's question using ONLY the candidate data below.
Be concise (max 4 sentences). Reference candidates by first name.
List the first names of any candidates you cite in "citedNames".
Suggest at most 2 follow-up actions the recruiter could take, choosing a kind:
- "compare" (compare specific candidates side by side)
- "email" (draft emails to candidates)
- "schedule" (schedule an interview)
- "none" (no action)
For each action set "candidateNames" to the relevant first names.

Candidate data:
${describeCandidates(input.candidates)}

Recruiter question: ${input.message}`,
      schema: z.object({
        reply: z.string(),
        citedNames: z.array(z.string()).default([]),
        actions: z
          .array(
            z.object({
              kind: z.enum(["compare", "email", "schedule", "none"]),
              label: z.string(),
              candidateNames: z.array(z.string()).default([]),
            })
          )
          .default([]),
      }),
    });

    return {
      actions: object.actions.map((action) => ({
        ids: matchNamesToIds(action.candidateNames, input.candidates),
        kind: action.kind,
        label: action.label,
      })),
      citationIds: matchNamesToIds(object.citedNames, input.candidates),
      reply: object.reply,
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
