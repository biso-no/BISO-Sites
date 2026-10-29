import type { RecruitmentVacancy } from "@repo/shared/types/recruitment";
import { CANDIDATE_PLACEHOLDER } from "@repo/shared/utils/screening-anonymizer";

export type RecruitmentEmailStage =
  | "interview_invite"
  | "rejection"
  | "request_more_info"
  | "offer"
  | "thank_you";

export interface DraftCandidateEmailInput {
  /** Optional HR notes the model should fold into the message. */
  context?: string | null;
  locale?: "no" | "en";
  model?: string;
  stage: RecruitmentEmailStage;
  tone?: "warm" | "neutral" | "concise";
  vacancy: Pick<RecruitmentVacancy, "translations" | "metadata">;
}

const STAGE_INSTRUCTIONS: Record<RecruitmentEmailStage, string> = {
  interview_invite:
    "Invite the candidate to an interview. Be warm; mention the next step is to coordinate a time.",
  offer:
    "Inform the candidate they have been offered the position. Be excited but professional; suggest a follow-up call.",
  rejection:
    "Politely inform the candidate they have not been selected. Be respectful and concise; thank them for applying.",
  request_more_info:
    "Ask the candidate for a specific piece of additional information or clarification.",
  thank_you:
    "Thank the candidate for completing an interview round and explain when they will hear back.",
};

export const RECRUITMENT_EMAIL_SYSTEM_PROMPT = `You are a recruitment communications assistant for
BISO, a Norwegian student union. Draft short, human-sounding emails on
behalf of BISO HR.

Constraints:
- Match the requested locale exactly: "no" = Norwegian Bokmål, "en" = English.
- Keep the body under 220 words.
- The candidate's name is withheld. Write "${CANDIDATE_PLACEHOLDER}" exactly
  where the candidate's first name belongs, for example "Hi ${CANDIDATE_PLACEHOLDER},".
  Never guess a name.
- Never invent facts about the candidate or the vacancy beyond the input.
- Sign off with "Best regards,\nBISO HR".
- The subject line must be under 90 characters and free of emojis.`;

export function buildCandidateEmailPrompt(
  input: DraftCandidateEmailInput
): string {
  const locale = input.locale ?? "no";
  const tone = input.tone ?? "warm";
  const title =
    input.vacancy.translations.find(
      (translation) => translation.locale === locale
    )?.title ??
    input.vacancy.translations[0]?.title ??
    "your application";

  const instructions = STAGE_INSTRUCTIONS[input.stage];

  return `Stage: ${input.stage}
Locale: ${locale}
Tone: ${tone}
Vacancy title: ${title}
Candidate name: ${CANDIDATE_PLACEHOLDER}
HR notes / context:
${input.context ?? "(none)"}

Instructions:
${instructions}

Draft the email now.`;
}
