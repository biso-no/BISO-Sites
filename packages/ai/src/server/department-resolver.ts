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
student organisation. Each licensed mailbox is provisioned per ROLE, not per person,
and the email local-part encodes the role:

- "role.campus" (two segments, e.g. "president.oslo", "controller.oslo") usually means
  a CAMPUS MANAGEMENT role → classification "management", department "Ledelsen {Campus}".
  BUT a two-segment address can also be a function (e.g. "hr.oslo") or a person
  (e.g. "adrian.oslo", a first name). Only classify as management when the first
  segment is clearly a leadership role (president, controller, vice president, etc.).
- "...deptabbrev.campus" (three+ segments, e.g. "finance.nu.oslo", "arezu.businessambassador.kd")
  where a segment is an ad-hoc abbreviation of a department → classification "department".
  Choose the ONE candidate department whose name the abbreviation contracts. Abbreviations are
  usually initials or a contraction of the department's words — e.g. "nu" = Næringslivsutvalget,
  "kd" = Karrieredagene, "mu" = Markedsutvalget. Match the abbreviation against the candidate
  list for this campus even when the rest of the local-part is a person name or a role word.
  Candidate names may themselves be truncated.
- A bare first name or "firstname.lastname" (e.g. "markus", "adrian.heien"), or an email whose
  abbreviation matches no candidate, → classification "manual" with department null.

Rules:
- The user's EXISTING M365 department is NOT provided and must NOT be assumed — earlier data is
  unreliable. Decide ONLY from the email local-part; use officeLocation solely as a campus hint.
- department MUST be exactly one of the provided candidate names, or null. Never invent one.
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
