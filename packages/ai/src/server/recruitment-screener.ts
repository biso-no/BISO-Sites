import "server-only";

import {
  computeScreeningNormalizedScore,
  parseRecruitmentAiScreening,
  type RecruitmentAiScreening,
  type RecruitmentScreeningRubric,
  type RecruitmentVacancy,
  recruitmentAiScreeningOutputSchema,
} from "@repo/shared/types/recruitment";
import {
  anonymizeScreeningText,
  type ScreeningAnonymizerOptions,
} from "@repo/shared/utils/screening-anonymizer";
import { generateObject } from "ai";
import { MODEL_IDS, resolveModel } from "../models";

/**
 * Screening input. Only fields that describe the candidate's fit belong here —
 * contact details, LinkedIn and employer are deliberately absent (GDPR data
 * minimisation). `applicant_name` is used solely to redact the name from free
 * text and is never sent to the model.
 */
export interface ScreenApplicationInput {
  /** Optional answers to per-vacancy custom questions. */
  answers?: Array<{
    question_label: string;
    answer: string | null;
  }>;
  application: {
    $id: string;
    applicant_name: string;
    cover_letter: string | null;
    current_role?: string | null;
  };
  /** Optional model override; defaults to the balanced tier (gpt-5.6-terra). */
  model?: string;
  /** Plaintext resume content — extract before calling. */
  resumeText?: string | null;
  /** Optional per-vacancy rubric (must_have / nice_to_have / criteria). */
  rubric?: RecruitmentScreeningRubric | null;
  vacancy: Pick<RecruitmentVacancy, "$id" | "metadata" | "translations">;
}

const RESUME_CHAR_LIMIT = 8000;

const SYSTEM_PROMPT = `You evaluate applications for volunteer positions at
BISO, the student organisation at BI Norwegian Business School. BISO is run by
students, and almost every position is an unpaid role filled by a current
student. Score how well a candidate matches a specific vacancy.

Calibrate to that context:
- Candidates are students. Relevant study programme, coursework, part-time or
  summer jobs, internships, and student-organisation involvement are real
  evidence of fit. Do not expect professional experience unless the rubric
  lists it as a must-have.
- Motivation, willingness to learn, and a clear link between the candidate's
  studies and the role count in their favour.
- Be selective but fair: the goal is to surface the strongest candidates, not
  to reject everyone who lacks a full professional track record.

Scoring scale (overall_score and every dimension score):
- 5 Exceptional: clearly exceeds the role; strong, concrete evidence.
- 4 Strong fit: meets the must-haves with evidence, e.g. a student in a
  relevant programme with some related experience or involvement.
- 3 Plausible fit: meets most requirements or is clearly trainable; worth a
  closer look.
- 2 Weak fit: little connection to the role, or several must-haves missing.
- 1 Clear mismatch.

Guidelines:
- Use the vacancy description and any rubric as the source of truth.
- A missed must-have lowers the score; a missed nice-to-have barely matters.
- Never invent facts; rely only on what the candidate provided. The CV and
  cover letter support each other: a claim in one backed by the other is
  evidence.
- Personal details have been redacted (shown as [Candidate], [email],
  [address], and so on). That is expected; never penalise it.
- Ignore age, gender, nationality, ethnicity, religion, health, family
  situation, and any other protected characteristic, even if mentioned.
- Recommend "interview" for 4–5, "reviewed" for 3, and "rejected" only for a
  clear mismatch (1–2).
- Be candid and concise. Respond in English. Keep summaries under 400
  characters.`;

function buildPrompt(input: ScreenApplicationInput): string {
  const norwegian = input.vacancy.translations.find(
    (translation) => translation.locale === "no"
  );
  const english = input.vacancy.translations.find(
    (translation) => translation.locale === "en"
  );
  const title = english?.title ?? norwegian?.title ?? "Untitled vacancy";
  const description =
    english?.description ?? norwegian?.description ?? "(no description)";

  const redaction: ScreeningAnonymizerOptions = {
    candidateName: input.application.applicant_name,
  };
  const redact = (text: string | null | undefined) =>
    anonymizeScreeningText(text, redaction);

  const rubricBlock = input.rubric
    ? `Must-have: ${input.rubric.must_have.join("; ") || "—"}
Nice-to-have: ${input.rubric.nice_to_have.join("; ") || "—"}
Custom criteria: ${
        (input.rubric.criteria ?? [])
          .map(
            (criterion) =>
              `${criterion.label} (weight ${criterion.weight}${criterion.description ? `: ${criterion.description}` : ""})`
          )
          .join("; ") || "—"
      }`
    : "(no rubric supplied)";

  const answersBlock =
    input.answers && input.answers.length > 0
      ? input.answers
          .map(
            (entry) =>
              `Q: ${entry.question_label}\nA: ${redact(entry.answer) ?? "(no answer)"}`
          )
          .join("\n\n")
      : "(no custom answers)";

  const resume = redact(input.resumeText?.slice(0, RESUME_CHAR_LIMIT));

  return `Vacancy title: ${title}
Vacancy description:
${description}

Rubric:
${rubricBlock}

Candidate current role: ${redact(input.application.current_role) ?? "—"}

Cover letter:
${redact(input.application.cover_letter) ?? "(none)"}

Custom-question answers:
${answersBlock}

CV text (truncated):
${resume || "(no CV provided)"}

Score this candidate against the vacancy using the scale above. Recommend
exactly one of: interview (strong or exceptional fit), reviewed (plausible
fit), rejected (clear mismatch).`;
}

export async function screenApplication(
  input: ScreenApplicationInput
): Promise<RecruitmentAiScreening> {
  const modelName = input.model ?? MODEL_IDS.balanced;
  const result = await generateObject({
    model: resolveModel(modelName),
    prompt: buildPrompt(input),
    schema: recruitmentAiScreeningOutputSchema,
    instructions: SYSTEM_PROMPT,
    // Applicant data must not be retained on OpenAI's side beyond the call.
    providerOptions: { openai: { store: false } },
  });

  // Metadata is stamped here rather than asked of the model — it cannot know
  // the wall clock or which model id the caller resolved. The 0–100 score is
  // derived in code so its bands are consistent across candidates.
  return {
    ...result.object,
    normalized_score: computeScreeningNormalizedScore(result.object),
    generated_at: new Date().toISOString(),
    model: modelName,
    version: 1,
  };
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
