import {
  anonymizeScreeningText,
  firstNameOf,
  redactNameWithLabel,
} from "@repo/shared/utils/screening-anonymizer";

/**
 * Prompt builders for the recruitment AI surfaces (compare verdict and header
 * assistant). Applicants are told AI help runs with their name and contact
 * details removed, so candidates are sent as `Candidate 1…N` labels and the
 * labels are turned back into first names only after the model has answered.
 */

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

const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

const LABEL_PATTERN = /\bCandidate (\d+)\b/g;

export function candidateLabel(index: number): string {
  return `Candidate ${index + 1}`;
}

export function buildLabelMap(
  candidates: AssistantCandidate[]
): Map<string, string> {
  return new Map(
    candidates.map((candidate, index) => [candidateLabel(index), candidate.id])
  );
}

/** Exact label to id lookup; anything that is not a known label is dropped. */
export function idsForLabels(
  labels: string[],
  labelMap: Map<string, string>
): string[] {
  const ids: string[] = [];
  for (const label of labels) {
    const id = labelMap.get(label.trim());
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

/** Turns `Candidate 3` back into that candidate's first name. */
export function restoreLabels(
  text: string,
  candidates: AssistantCandidate[]
): string {
  return text.replace(LABEL_PATTERN, (whole, digits: string) => {
    const candidate = candidates[Number(digits) - 1];
    return candidate ? firstNameOf(candidate.name) || whole : whole;
  });
}

function scrub(text: string, candidate: AssistantCandidate): string {
  return anonymizeScreeningText(text, { candidateName: candidate.name }) ?? "";
}

export function describeCandidates(candidates: AssistantCandidate[]): string {
  return candidates
    .map((candidate, index) => {
      const strengths = candidate.strengths.map((item) =>
        scrub(item, candidate)
      );
      const gaps = candidate.gaps.map((item) => scrub(item, candidate));
      return `- ${candidateLabel(index)} | stage=${candidate.stage} | match=${
        candidate.score ?? "n/a"
      } | ${candidate.days}d in pipeline | source=${
        candidate.source ?? "unknown"
      } | strengths: ${strengths.join("; ") || "—"} | gaps: ${
        gaps.join("; ") || "—"
      }`;
    })
    .join("\n");
}

/** Replaces any candidate name in the recruiter's text with its label. */
export function pseudonymiseMessage(
  message: string,
  candidates: AssistantCandidate[]
): string {
  let result = message;
  // Full names first, so a surname shared by several candidates cannot turn
  // "Ola Berg" into the label of someone else.
  candidates.forEach((candidate, index) => {
    const full = candidate.name.trim();
    if (full) {
      result = result.replace(
        new RegExp(full.replace(REGEX_SPECIAL, "\\$&"), "giu"),
        () => candidateLabel(index)
      );
    }
  });
  candidates.forEach((candidate, index) => {
    result = redactNameWithLabel(result, candidate.name, candidateLabel(index));
  });
  return anonymizeScreeningText(result) ?? "";
}

export function buildComparePrompt(
  jobTitle: string,
  candidates: AssistantCandidate[]
): string {
  return `You are a hiring copilot comparing candidates for "${jobTitle}".
Write a 2-3 sentence verdict on who fits best and the key trade-off.
Candidates are anonymised. Refer to them only by their label (for example "Candidate 2"). Pick a single winner and return its label in "winnerLabel".

Candidates:
${describeCandidates(candidates)}`;
}

export function buildAssistantPrompt(
  jobTitle: string,
  message: string,
  candidates: AssistantCandidate[]
): string {
  return `You are the recruitment pipeline copilot for the vacancy "${jobTitle}".
Answer the recruiter's question using ONLY the candidate data below.
Be concise (max 4 sentences). Candidates are anonymised: refer to them only by their label (for example "Candidate 2").
List the labels of any candidates you cite in "citedLabels".
Suggest at most 2 follow-up actions the recruiter could take, choosing a kind:
- "compare" (compare specific candidates side by side)
- "email" (draft emails to candidates)
- "schedule" (schedule an interview)
- "none" (no action)
For each action set "candidateLabels" to the relevant labels.

Candidate data:
${describeCandidates(candidates)}

Recruiter question: ${pseudonymiseMessage(message, candidates)}`;
}
