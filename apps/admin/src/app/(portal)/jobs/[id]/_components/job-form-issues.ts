/**
 * Maps schema issues from `recruitmentVacancyUpsertSchema` to something the
 * job studio can show: a human label, the editor step that holds the field,
 * and (for per-locale fields) which language tab to open.
 */

export interface JobFormIssue {
  field: string;
  label: string;
  locale: "en" | "no" | null;
  message: string;
  step: number;
}

interface SchemaIssueLike {
  code?: string;
  maximum?: unknown;
  message: string;
  path: readonly PropertyKey[];
}

const STEP_ESSENTIALS = 0;
const STEP_DESCRIPTION = 1;
const STEP_LOGISTICS = 2;
const STEP_SCREENING = 3;
const STEP_VISIBILITY = 4;

const FIELD_META: Record<string, { label: string; step: number }> = {
  application_deadline: { label: "Application deadline", step: STEP_LOGISTICS },
  campus_id: { label: "Campus", step: STEP_ESSENTIALS },
  commitment: { label: "Commitment", step: STEP_LOGISTICS },
  company: { label: "Company", step: STEP_LOGISTICS },
  contact_email: { label: "Contact email", step: STEP_LOGISTICS },
  contact_name: { label: "Contact name", step: STEP_LOGISTICS },
  contact_role: { label: "Contact role", step: STEP_LOGISTICS },
  cover_image_url: { label: "Cover image", step: STEP_VISIBILITY },
  department_id: { label: "Department", step: STEP_ESSENTIALS },
  description_en: { label: "Description", step: STEP_DESCRIPTION },
  description_no: { label: "Description", step: STEP_DESCRIPTION },
  location: { label: "Location", step: STEP_LOGISTICS },
  scheduled_publish_at: {
    label: "Scheduled publish time",
    step: STEP_VISIBILITY,
  },
  screening_rubric: { label: "Screening criteria", step: STEP_SCREENING },
  short_description_en: { label: "One-line teaser", step: STEP_ESSENTIALS },
  short_description_no: { label: "One-line teaser", step: STEP_ESSENTIALS },
  slug: { label: "URL slug", step: STEP_ESSENTIALS },
  start_date: { label: "Start date", step: STEP_LOGISTICS },
  tags: { label: "Tags", step: STEP_ESSENTIALS },
  term: { label: "Term", step: STEP_LOGISTICS },
  title_en: { label: "Title", step: STEP_ESSENTIALS },
  title_no: { label: "Title", step: STEP_ESSENTIALS },
};

const LOCALE_SUFFIX_REGEX = /_(en|no)$/;

function friendlyMessage(issue: SchemaIssueLike): string {
  if (issue.code === "too_big" && typeof issue.maximum === "number") {
    return `Must be at most ${issue.maximum} characters`;
  }
  if (issue.code === "invalid_format" || issue.message.includes("email")) {
    return issue.path[0] === "contact_email"
      ? "Enter a valid email address"
      : issue.message;
  }
  return issue.message;
}

export function describeJobFormIssue(issue: SchemaIssueLike): JobFormIssue {
  const field = String(issue.path[0] ?? "form");
  // The "one complete language" refinement is reported on title_no but is
  // satisfied by either language, so don't force the Norwegian tab.
  if (issue.code === "custom" && field === "title_no") {
    return {
      field: "content",
      label: "Title and description",
      locale: null,
      message: issue.message,
      step: STEP_ESSENTIALS,
    };
  }
  const meta = FIELD_META[field];
  const localeMatch = LOCALE_SUFFIX_REGEX.exec(field);
  const locale = (localeMatch?.[1] as "en" | "no" | undefined) ?? null;
  const localeLabel = locale ? ` (${locale.toUpperCase()})` : "";

  return {
    field,
    label: `${meta?.label ?? field}${localeLabel}`,
    locale,
    message: friendlyMessage(issue),
    step: meta?.step ?? STEP_ESSENTIALS,
  };
}

export function describeJobFormIssues(
  issues: readonly SchemaIssueLike[]
): JobFormIssue[] {
  const seen = new Set<string>();
  const result: JobFormIssue[] = [];
  for (const issue of issues) {
    const described = describeJobFormIssue(issue);
    if (seen.has(described.field)) {
      continue;
    }
    seen.add(described.field);
    result.push(described);
  }
  return result;
}
