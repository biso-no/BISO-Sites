import "server-only";

import { openai } from "@ai-sdk/openai";
import {
  type DepartmentResolution,
  departmentResolutionBatchSchema,
} from "@repo/shared/types/user-management";
import { generateObject } from "ai";

export interface ResolveDepartmentsInput {
  campusLabel: string; // e.g. "Oslo" or "National/unknown" (context only)
  candidates: string[]; // canonical department names the model may choose from
  model?: string; // defaults to gpt-5.4-mini
  users: Array<{
    email: string; // local-part of the role mailbox, e.g. "finance.nu.oslo"
    office: string; // current officeLocation (campus); only a campus hint
    ref: string; // opaque key echoed back (the M365 user id)
  }>;
}

const SYSTEM_PROMPT = `You normalise Microsoft 365 user records for BISO, a Norwegian
student organisation. Each licensed mailbox is provisioned per ROLE, not per person.
Decide each user's department from the email local-part; officeLocation is only a campus
hint and the existing department is NOT provided (earlier data is unreliable).

Candidate departments are prefixed with a campus code: OSL = Oslo, BRG = Bergen,
TRD = Trondheim, STV = Stavanger. Always set "campus" to the full campus name of the
chosen department's prefix (e.g. "BRG Bergensbaneløpet" → campus "Bergen"). The email's
LAST segment is often the campus (oslo/bergen/trondheim/stavanger), but NOT always — when
the email has no campus token, infer the campus from the matched department's prefix.

Known department abbreviations (ad-hoc; the local-part contracts the department name):
- fr = Fadderullan
- kd = Karrieredagene
- nu = Næringslivsutvalget
- vl = Vinterlekene (Winter Games)
- bbl = Bergensbaneløpet
- mu = Markedsutvalget

Classification:
- A segment is a department abbreviation or department word (e.g. "finance.nu.oslo",
  "ambassador.fr.oslo", "ailo.business.bbl", "alexander.accounting") → "department".
  Choose the ONE candidate whose name the abbreviation/word contracts, using the glossary.
  The abbreviation may be the LAST segment with no campus token — then infer the campus
  from the matched department's prefix. confidence "high" when the match is clear.
- A campus leadership or support role with NO department abbreviation (e.g. "president.oslo",
  "controller.oslo", "academics.bergen", "advisor.business.oslo", "advisor.operations.oslo",
  "academics.assistant.bergen") → "management", department "Ledelsen {Campus}". Use
  confidence "high" for clear leadership titles (president, vice president, controller) and
  "medium" for assistant/advisor/academics/business/operations support roles (an assumption
  to confirm).
- A bare first name or "firstname.lastname" (e.g. "markus", "adrian.heien"), or an email whose
  abbreviation matches no candidate and is not a leadership/support role → "manual", null.

Rules:
- department MUST be exactly one of the provided candidate names, or null. Never invent one.
  Some candidates are inactive/closed (their name may end with "- nedlagt") — still choose them
  when the email clearly belongs there.
- Prefer a department match over "management"; only use "Ledelsen {Campus}" when no candidate
  department fits and the role is clearly leadership/support.
- confidence "high" only when the email clearly determines the answer.
- Echo each user's ref unchanged. Keep reasoning to one short sentence.`;

function buildPrompt(input: ResolveDepartmentsInput): string {
  const candidateList =
    input.candidates.length > 0
      ? input.candidates.map((c) => `- ${c}`).join("\n")
      : "(none — classify these as manual unless clearly management)";
  const userList = input.users
    .map(
      (u) =>
        `ref=${u.ref} | email=${u.email} | office=${u.office || "(blank)"}`
    )
    .join("\n");

  return `Campus context: ${input.campusLabel}

Candidate departments for this campus:
${candidateList}

Classify each user below. Return one resolution per user, echoing its ref.

Users:
${userList}`;
}

export async function resolveDepartments(
  input: ResolveDepartmentsInput
): Promise<DepartmentResolution[]> {
  if (input.users.length === 0) {
    return [];
  }
  const model = input.model ?? "gpt-5.4-mini";
  console.info(
    `[dept-resolver] generateObject(${model}) for ${input.campusLabel}: ${input.users.length} users, ${input.candidates.length} candidates`
  );
  const result = await generateObject({
    model: openai(model),
    prompt: buildPrompt(input),
    schema: departmentResolutionBatchSchema,
    system: SYSTEM_PROMPT,
  });
  return result.object.resolutions;
}
