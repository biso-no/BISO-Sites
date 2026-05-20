import "server-only";

import { openai } from "@ai-sdk/openai";
import {
  parseRecruitmentAiScreening,
  type RecruitmentAiScreening,
  recruitmentAiScreeningSchema,
  type RecruitmentScreeningRubric,
  type RecruitmentVacancy,
} from "@repo/shared/types/recruitment";
import { generateObject } from "ai";

export interface ScreenApplicationInput {
  vacancy: Pick<RecruitmentVacancy, "$id" | "metadata" | "translation_refs">;
  application: {
    $id: string;
    applicant_name: string;
    applicant_email: string;
    cover_letter: string | null;
    current_role?: string | null;
    current_employer?: string | null;
    linkedin_url?: string | null;
  };
  /** Plaintext resume content — extract before calling. */
  resumeText?: string | null;
  /** Optional per-vacancy rubric (must_have / nice_to_have / criteria). */
  rubric?: RecruitmentScreeningRubric | null;
  /** Optional model override; defaults to gpt-5-nano to match existing jobs.ts. */
  model?: string;
  /** Optional answers to per-vacancy custom questions. */
  answers?: Array<{
    question_label: string;
    answer: string | null;
  }>;
}

const SYSTEM_PROMPT = `You evaluate volunteer applications for BISO, the
student union at BI Norwegian Business School. Score how well a candidate
matches a specific vacancy.

Guidelines:
- Use the vacancy description and any rubric as the source of truth.
- Be candid and concise.
- Never invent facts; rely on what the candidate provided.
- A "must-have" miss should lower the overall score significantly.
- Penalise unsupported claims; reward concrete evidence.
- Respond in English. Keep summaries under 400 characters.`;

function buildPrompt(input: ScreenApplicationInput): string {
  const norwegian = input.vacancy.translation_refs.find(
    (translation) => translation.locale === "no"
  );
  const english = input.vacancy.translation_refs.find(
    (translation) => translation.locale === "en"
  );
  const title = english?.title ?? norwegian?.title ?? "Untitled vacancy";
  const description =
    english?.description ?? norwegian?.description ?? "(no description)";

  const rubricBlock = input.rubric
    ? `Must-have: ${input.rubric.must_have.join("; ") || "—"}
Nice-to-have: ${input.rubric.nice_to_have.join("; ") || "—"}
Custom criteria: ${(input.rubric.criteria ?? [])
        .map(
          (criterion) =>
            `${criterion.label} (weight ${criterion.weight}${criterion.description ? `: ${criterion.description}` : ""})`
        )
        .join("; ") || "—"}`
    : "(no rubric supplied)";

  const answersBlock =
    input.answers && input.answers.length > 0
      ? input.answers
          .map(
            (entry) =>
              `Q: ${entry.question_label}\nA: ${entry.answer ?? "(no answer)"}`
          )
          .join("\n\n")
      : "(no custom answers)";

  return `Vacancy title: ${title}
Vacancy description:
${description}

Rubric:
${rubricBlock}

Candidate name: ${input.application.applicant_name}
Candidate current role: ${input.application.current_role ?? "—"}
Candidate current employer: ${input.application.current_employer ?? "—"}
LinkedIn: ${input.application.linkedin_url ?? "—"}

Cover letter:
${input.application.cover_letter ?? "(none)"}

Custom-question answers:
${answersBlock}

Resume text (truncated):
${(input.resumeText ?? "(no resume parsed)").slice(0, 8000)}

Score this candidate strictly against the vacancy. Recommend exactly one
of: reviewed (good fit), interview (excellent fit), rejected (clear no).`;
}

export async function screenApplication(
  input: ScreenApplicationInput
): Promise<RecruitmentAiScreening> {
  const modelName = input.model ?? "gpt-5-nano";
  const result = await generateObject({
    model: openai(modelName),
    prompt: buildPrompt(input),
    schema: recruitmentAiScreeningSchema,
    system: SYSTEM_PROMPT,
  });

  return result.object;
}

export function normalizeScreeningScore(
  screening: RecruitmentAiScreening
): number {
  if (typeof screening.normalized_score === "number") {
    return Math.min(100, Math.max(0, Math.round(screening.normalized_score)));
  }
  return Math.round(((screening.overall_score - 1) / 4) * 100);
}

export function parseScreeningJson(
  value: unknown
): RecruitmentAiScreening | null {
  return parseRecruitmentAiScreening(value);
}
