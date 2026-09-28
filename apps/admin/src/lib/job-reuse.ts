import { JobsStatus } from "@repo/api/types/appwrite";
import type {
  RecruitmentVacancy,
  RecruitmentVacancyWriteInput,
} from "@repo/shared/types/recruitment";

/**
 * Why a vacancy looks like a finished recruitment round. HR used to reopen
 * last year's vacancy, rewrite it and republish, which mixes the new round's
 * applicants into the old round's pipeline. The studio uses these signals to
 * steer them to "Duplicate" instead.
 */
export type JobReuseReason = "closed" | "deadline_passed" | "has_applications";

export interface JobReuseSignals {
  applicationCount: number;
  reasons: JobReuseReason[];
  /** True when the studio should suggest duplicating instead of editing. */
  suggestDuplicate: boolean;
}

export function describeJobReuse({
  applicationCount,
  applicationDeadline,
  now = new Date(),
  status,
}: {
  applicationCount: number;
  applicationDeadline: string | null;
  now?: Date;
  status: JobsStatus;
}): JobReuseSignals {
  const deadline = applicationDeadline ? new Date(applicationDeadline) : null;
  const deadlinePassed =
    deadline !== null &&
    !Number.isNaN(deadline.getTime()) &&
    deadline.getTime() < now.getTime();
  const isClosed = status === JobsStatus.CLOSED;
  const hasApplications = applicationCount > 0;

  const reasons: JobReuseReason[] = [];
  if (isClosed) {
    reasons.push("closed");
  }
  if (deadlinePassed) {
    reasons.push("deadline_passed");
  }
  if (hasApplications) {
    reasons.push("has_applications");
  }

  // A live vacancy that is still taking applications is normal to edit (a
  // typo, a new contact). Nudge only once the round has ended, or when a
  // vacancy with applicants was taken offline — the usual first step of
  // "rewrite and republish".
  const roundEnded = isClosed || deadlinePassed;
  const unpublishedWithApplicants =
    hasApplications && status !== JobsStatus.PUBLISHED;

  return {
    applicationCount,
    reasons,
    suggestDuplicate: roundEnded || unpublishedWithApplicants,
  };
}

// A year, optionally followed by the `-2`, `-3` counter this helper adds.
const TRAILING_YEAR_RE = /-(?:19|20)\d{2}(?:-\d{1,3})?$/;
const TRAILING_COPY_RE = /-copy(?:-\d+)?$/;
const MAX_SLUG_LENGTH = 120;

/**
 * Slugs to try for a copy of `sourceSlug`, most preferred first. A trailing
 * year is swapped for `year`, so `styremedlem-2025` becomes `styremedlem-2026`
 * rather than `styremedlem-2025-copy`.
 */
export function buildDuplicateSlugCandidates(
  sourceSlug: string,
  year: number,
  count = 20
): string[] {
  let base = sourceSlug;
  // Strip repeatedly: `x-2025-copy-2` and `x-copy-2025` both reduce to `x`.
  let previous = "";
  while (previous !== base) {
    previous = base;
    base = base.replace(TRAILING_COPY_RE, "").replace(TRAILING_YEAR_RE, "");
  }
  const stem = `${base || "vacancy"}-${year}`.slice(0, MAX_SLUG_LENGTH);
  const candidates = [stem];
  for (let n = 2; candidates.length < count; n += 1) {
    candidates.push(`${stem}-${n}`);
  }
  return candidates;
}

/**
 * The write input for a fresh draft copy of `source`. Content, screening,
 * application questions and interview rounds carry over; anything tied to the
 * old round's calendar (deadline, start date, publish schedule) is cleared so
 * HR has to set it for the new round.
 */
export function buildDuplicateVacancyInput(
  source: RecruitmentVacancy,
  slug: string
): RecruitmentVacancyWriteInput {
  const no = source.translations.find((t) => t.locale === "no");
  const en = source.translations.find((t) => t.locale === "en");
  const { metadata } = source;
  return {
    application_deadline: null,
    audience: metadata.audience ?? "members",
    auto_screen: source.auto_screen,
    auto_translate: metadata.auto_translate,
    campus_id: source.campus_id,
    commitment: metadata.commitment ?? null,
    company: metadata.company ?? null,
    contact_email: metadata.contact_email ?? null,
    contact_name: metadata.contact_name ?? null,
    contact_role: metadata.contact_role ?? null,
    cover_image_file_id: metadata.cover_image_file_id ?? null,
    cover_image_url: metadata.cover_image_url ?? null,
    cover_pattern: metadata.cover_pattern ?? null,
    custom_questions: source.custom_questions,
    cv_required: metadata.cv_required,
    department_id: source.department_id,
    description_en: en?.description ?? "",
    description_no: no?.description ?? "",
    employment_type: metadata.employment_type ?? null,
    interview_template: source.interview_template ?? { rounds: [] },
    location: metadata.location ?? null,
    newsletter: metadata.newsletter,
    paid: metadata.paid,
    publication_mode: "now",
    push_to_inboxes: metadata.push_to_inboxes,
    scheduled_publish_at: null,
    screening_rubric: source.screening_rubric ?? {
      criteria: [],
      must_have: [],
      nice_to_have: [],
    },
    short_description_en:
      en?.short_description ?? metadata.short_description ?? null,
    short_description_no:
      no?.short_description ?? metadata.short_description ?? null,
    slug,
    start_date: null,
    status: JobsStatus.DRAFT,
    tags: metadata.tags,
    term: metadata.term ?? null,
    title_en: en?.title ?? "",
    title_no: no?.title ?? "",
  };
}
