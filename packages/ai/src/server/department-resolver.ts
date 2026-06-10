import "server-only";

import {
  type DepartmentResolution,
  departmentResolutionBatchSchema,
} from "@repo/shared/types/user-management";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";

export interface ResolveDepartmentsInput {
  campusLabel: string; // e.g. "Oslo" or "National/unknown" (context only)
  candidates: string[]; // canonical department names the model may choose from
  model?: string; // defaults to gpt-5-nano
  users: Array<{
    department: string; // current freeform M365 department (may be wrong/blank)
    email: string; // local-part of the role mailbox, e.g. "finance.nu.oslo"
    office: string; // current officeLocation (may be wrong/blank)
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
- "function.deptabbrev.campus" (three+ segments, e.g. "finance.nu.oslo" where "nu" is an
  ad-hoc abbreviation of a department) → classification "department". Choose the ONE
  candidate department that the abbreviation/department best matches. Abbreviations are
  ad-hoc (e.g. "nu" = Næringslivsutvalget). Candidate names may themselves be truncated.
- A bare first name or "firstname.lastname" (e.g. "markus", "adrian.heien"), or anything
  you cannot confidently place, → classification "manual" with department null.

Rules:
- department MUST be exactly one of the provided candidate names, or null. Never invent one.
- Use the current department/office only as weak hints; the email is the source of truth.
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
        `ref=${u.ref} | email=${u.email} | department=${u.department || "(blank)"} | office=${u.office || "(blank)"}`
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
  const model = input.model ?? "gpt-5-nano";
  const result = await generateObject({
    model: openai(model),
    prompt: buildPrompt(input),
    schema: departmentResolutionBatchSchema,
    system: SYSTEM_PROMPT,
  });
  return result.object.resolutions;
}
