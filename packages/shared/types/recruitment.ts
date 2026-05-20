import {
  JobApplicationStatus,
  JobStatus,
  type Locale,
} from "@repo/api/types/appwrite";
import { z } from "zod";

const nullableTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().max(max).nullable().optional());

const nullableDateString = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z
    .string()
    .nullable()
    .optional()
    .refine(
      (value) => value == null || !Number.isNaN(Date.parse(value)),
      "Invalid date"
    )
);

const nullableInteger = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? Number(trimmed) : null;
  }
  return value;
}, z.number().int().nullable().optional());

const recruitmentAudienceSchema = z.enum(["members", "public"]);
const recruitmentPublicationModeSchema = z.enum(["now", "scheduled"]);
const recruitmentInterviewStatusSchema = z.enum([
  "none",
  "requested",
  "scheduled",
  "completed",
  "cancelled",
]);

export const recruitmentCustomQuestionTypeSchema = z.enum([
  "text",
  "long_text",
  "select",
  "multi_select",
  "boolean",
  "number",
]);

export type RecruitmentCustomQuestionType = z.infer<
  typeof recruitmentCustomQuestionTypeSchema
>;

export const recruitmentCustomQuestionSchema = z.object({
  id: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(500),
  type: recruitmentCustomQuestionTypeSchema,
  required: z.boolean().default(false),
  help_text: nullableTrimmedString(500),
  options: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .optional()
    .default([]),
});

export type RecruitmentCustomQuestion = z.infer<
  typeof recruitmentCustomQuestionSchema
>;

export const recruitmentCustomQuestionsSchema = z
  .array(recruitmentCustomQuestionSchema)
  .max(20);

export const recruitmentInterviewRoundTemplateSchema = z.object({
  id: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(200),
  default_duration_minutes: z.number().int().min(15).max(240).default(45),
  default_panel_user_ids: z
    .array(z.string().trim().min(1).max(50))
    .max(10)
    .optional()
    .default([]),
  agenda: nullableTrimmedString(2000),
});

export type RecruitmentInterviewRoundTemplate = z.infer<
  typeof recruitmentInterviewRoundTemplateSchema
>;

export const recruitmentInterviewTemplateSchema = z.object({
  rounds: z.array(recruitmentInterviewRoundTemplateSchema).max(10).default([]),
});

export type RecruitmentInterviewTemplate = z.infer<
  typeof recruitmentInterviewTemplateSchema
>;

export const recruitmentScreeningCriterionSchema = z.object({
  key: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(200),
  weight: z.number().min(0).max(10).default(1),
  description: nullableTrimmedString(500),
});

export type RecruitmentScreeningCriterion = z.infer<
  typeof recruitmentScreeningCriterionSchema
>;

export const recruitmentScreeningRubricSchema = z.object({
  must_have: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  nice_to_have: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  criteria: z.array(recruitmentScreeningCriterionSchema).max(10).default([]),
});

export type RecruitmentScreeningRubric = z.infer<
  typeof recruitmentScreeningRubricSchema
>;

export const recruitmentRecommendationSchema = z.enum([
  "strong_hire",
  "hire",
  "no_hire",
  "strong_no_hire",
  "need_more_info",
]);

export type RecruitmentRecommendation = z.infer<
  typeof recruitmentRecommendationSchema
>;

export const recruitmentNewInterviewStatusSchema = z.enum([
  "proposed",
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
]);

export type RecruitmentNewInterviewStatus = z.infer<
  typeof recruitmentNewInterviewStatusSchema
>;

export const RECRUITMENT_RESUME_BUCKET_ID = "recruitment_resumes";
export const RECRUITMENT_RETENTION_DAYS = 180;
export const RECRUITMENT_MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const RECRUITMENT_ALLOWED_RESUME_MIME_TYPES = [
  "application/pdf",
] as const;

export const recruitmentVacancyMetadataSchema = z
  .object({
    company: nullableTrimmedString(200),
    employment_type: nullableTrimmedString(100),
    paid: z.boolean().optional().default(false),
    short_description: nullableTrimmedString(280),
    location: nullableTrimmedString(200),
    application_deadline: nullableDateString,
    contact_name: nullableTrimmedString(200),
    contact_email: z.preprocess((value) => {
      if (typeof value !== "string") {
        return value;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }, z.email().nullable().optional()),
    cv_required: z.boolean().optional().default(false),
    tags: z
      .array(z.string().trim().min(1).max(40))
      .max(4)
      .optional()
      .default([]),
    commitment: nullableTrimmedString(120),
    term: nullableTrimmedString(120),
    start_date: nullableDateString,
    audience: recruitmentAudienceSchema.nullable().optional(),
    contact_role: nullableTrimmedString(120),
    cover_pattern: nullableInteger,
    cover_image_file_id: nullableTrimmedString(200),
    cover_image_url: nullableTrimmedString(1000),
    auto_translate: z.boolean().optional().default(false),
    push_to_inboxes: z.boolean().optional().default(false),
    newsletter: z.boolean().optional().default(false),
    publication_mode: recruitmentPublicationModeSchema.nullable().optional(),
    scheduled_publish_at: nullableDateString,
    auto_screen: z.boolean().optional().default(true),
  })
  .catchall(z.unknown());

export type RecruitmentVacancyMetadata = z.infer<
  typeof recruitmentVacancyMetadataSchema
>;

export const recruitmentVacancyUpsertSchema = z.object({
  title_no: z.string().trim().min(1, "Title (NO) is required"),
  title_en: z.string().trim().min(1, "Title (EN) is required"),
  description_no: z.string().trim().min(1, "Description (NO) is required"),
  description_en: z.string().trim().min(1, "Description (EN) is required"),
  campus_id: z.string().trim().min(1, "Campus is required"),
  department_id: nullableTrimmedString(50),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  status: z.nativeEnum(JobStatus),
  company: nullableTrimmedString(200),
  employment_type: nullableTrimmedString(100),
  paid: z.boolean().default(false),
  short_description: nullableTrimmedString(280),
  location: nullableTrimmedString(200),
  application_deadline: nullableDateString,
  contact_name: nullableTrimmedString(200),
  contact_email: z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.email().nullable().optional()),
  cv_required: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1).max(40)).max(4).default([]),
  commitment: nullableTrimmedString(120),
  term: nullableTrimmedString(120),
  start_date: nullableDateString,
  audience: recruitmentAudienceSchema.nullable().optional(),
  contact_role: nullableTrimmedString(120),
  cover_pattern: nullableInteger,
  cover_image_file_id: nullableTrimmedString(200),
  cover_image_url: nullableTrimmedString(1000),
  auto_translate: z.boolean().default(false),
  push_to_inboxes: z.boolean().default(false),
  newsletter: z.boolean().default(false),
  publication_mode: recruitmentPublicationModeSchema.nullable().optional(),
  scheduled_publish_at: nullableDateString,
  auto_screen: z.boolean().default(true),
  custom_questions: recruitmentCustomQuestionsSchema.optional().default([]),
  interview_template: recruitmentInterviewTemplateSchema
    .optional()
    .default({ rounds: [] }),
  screening_rubric: recruitmentScreeningRubricSchema
    .optional()
    .default({ must_have: [], nice_to_have: [], criteria: [] }),
});

export type RecruitmentVacancyUpsertInput = z.infer<
  typeof recruitmentVacancyUpsertSchema
>;

export function parseRecruitmentCustomQuestions(
  value: unknown
): RecruitmentCustomQuestion[] {
  if (value == null) {
    return [];
  }
  const raw = typeof value === "string" ? safeJsonParse(value) : value;
  const parsed = recruitmentCustomQuestionsSchema.safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function parseRecruitmentInterviewTemplate(
  value: unknown
): RecruitmentInterviewTemplate {
  if (value == null) {
    return { rounds: [] };
  }
  const raw = typeof value === "string" ? safeJsonParse(value) : value;
  const parsed = recruitmentInterviewTemplateSchema.safeParse(raw);
  return parsed.success ? parsed.data : { rounds: [] };
}

export function parseRecruitmentScreeningRubric(
  value: unknown
): RecruitmentScreeningRubric {
  const empty: RecruitmentScreeningRubric = {
    must_have: [],
    nice_to_have: [],
    criteria: [],
  };
  if (value == null) {
    return empty;
  }
  const raw = typeof value === "string" ? safeJsonParse(value) : value;
  const parsed = recruitmentScreeningRubricSchema.safeParse(raw);
  return parsed.success ? parsed.data : empty;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export const recruitmentApplicationAnswerInputSchema = z.object({
  question_id: z.string().trim().min(1).max(50),
  question_label: z.string().trim().min(1).max(500),
  answer_type: recruitmentCustomQuestionTypeSchema,
  answer: z.string().max(4000).nullable().optional(),
});

export type RecruitmentApplicationAnswerInput = z.infer<
  typeof recruitmentApplicationAnswerInputSchema
>;

export const recruitmentApplicationSubmitSchema = z.object({
  applicant_name: z.string().trim().min(1, "Name is required").max(200),
  applicant_email: z.email("A valid email is required"),
  applicant_phone: nullableTrimmedString(50),
  cover_letter: nullableTrimmedString(4000),
  candidate_availability: z
    .array(z.string().trim().min(1).max(160))
    .max(12)
    .optional()
    .default([]),
  gdpr_consent: z
    .boolean()
    .refine((value) => value === true, "GDPR consent is required"),
  answers: z
    .array(recruitmentApplicationAnswerInputSchema)
    .max(20)
    .optional()
    .default([]),
  linkedin_url: nullableTrimmedString(500),
  current_role: nullableTrimmedString(200),
  current_employer: nullableTrimmedString(200),
});

export type RecruitmentApplicationSubmitInput = z.infer<
  typeof recruitmentApplicationSubmitSchema
>;

export const recruitmentApplicationStatusUpdateSchema = z.object({
  status: z.nativeEnum(JobApplicationStatus),
});

export type RecruitmentApplicationStatusUpdateInput = z.infer<
  typeof recruitmentApplicationStatusUpdateSchema
>;

export const recruitmentApplicationReviewMetadataSchema = z
  .object({
    assigned_hr_user_email: nullableTrimmedString(200),
    assigned_hr_user_id: nullableTrimmedString(100),
    assigned_hr_user_name: nullableTrimmedString(200),
    candidate_availability: z
      .array(z.string().trim().min(1).max(160))
      .max(12)
      .optional()
      .default([]),
    hr_availability: z
      .array(z.string().trim().min(1).max(160))
      .max(12)
      .optional()
      .default([]),
    interview_duration_minutes: z
      .number()
      .int()
      .min(15)
      .max(180)
      .nullable()
      .optional(),
    interview_location: nullableTrimmedString(200),
    interview_meeting_url: nullableTrimmedString(1000),
    interview_notes: nullableTrimmedString(2000),
    interview_starts_at: nullableDateString,
    interview_status: recruitmentInterviewStatusSchema
      .optional()
      .default("none"),
    last_reviewed_at: nullableDateString,
    last_reviewed_by: nullableTrimmedString(200),
    review_notes: nullableTrimmedString(4000),
    score: z.number().int().min(1).max(5).nullable().optional(),
    ai_email_drafts: z
      .record(z.string(), z.unknown())
      .optional()
      .default({}),
    ai_screening_summary: nullableTrimmedString(2000),
  })
  .catchall(z.unknown());

export const recruitmentApplicationReviewUpdateSchema =
  recruitmentApplicationReviewMetadataSchema.partial();

export type RecruitmentApplicationReviewMetadata = z.infer<
  typeof recruitmentApplicationReviewMetadataSchema
>;

export type RecruitmentApplicationReviewUpdateInput = z.infer<
  typeof recruitmentApplicationReviewUpdateSchema
>;

export interface RecruitmentTranslation {
  $id: string;
  additional_fields: string | null;
  description: string;
  locale: Locale;
  short_description: string | null;
  title: string;
}

export interface RecruitmentCampusRef {
  $id: string;
  name: string;
}

export interface RecruitmentDepartmentRef {
  $id: string;
  campus_id?: string;
  Name: string;
}

export interface RecruitmentVacancy {
  $createdAt: string;
  $id: string;
  $updatedAt: string;
  campus: RecruitmentCampusRef | null;
  campus_id: string;
  department: RecruitmentDepartmentRef | null;
  department_id: string | null;
  metadata: RecruitmentVacancyMetadata;
  slug: string;
  status: JobStatus;
  translation_refs: RecruitmentTranslation[];
  custom_questions: RecruitmentCustomQuestion[];
  screening_rubric: RecruitmentScreeningRubric | null;
  interview_template: RecruitmentInterviewTemplate | null;
  auto_screen: boolean;
}

export interface RecruitmentApplicationJobSummary {
  $id: string;
  campus_id: string;
  department_id: string | null;
  slug: string;
  status: JobStatus;
  title: string;
}

export interface RecruitmentApplicationRecord {
  $createdAt: string;
  $id: string;
  $updatedAt: string;
  applicant_email: string;
  applicant_name: string;
  applicant_phone: string | null;
  consent_date: string;
  cover_letter: string | null;
  data_processing_purpose: string;
  data_retention_until: string;
  gdpr_consent: boolean;
  job: RecruitmentApplicationJobSummary | null;
  job_id: string;
  resume_file_id: string | null;
  review_metadata: RecruitmentApplicationReviewMetadata;
  status: JobApplicationStatus;
}

const STATUS_TRANSITIONS: Record<
  JobApplicationStatus,
  readonly JobApplicationStatus[]
> = {
  [JobApplicationStatus.SUBMITTED]: [
    JobApplicationStatus.REVIEWED,
    JobApplicationStatus.REJECTED,
  ],
  [JobApplicationStatus.REVIEWED]: [
    JobApplicationStatus.INTERVIEW,
    JobApplicationStatus.REJECTED,
  ],
  [JobApplicationStatus.INTERVIEW]: [
    JobApplicationStatus.REVIEWED,
    JobApplicationStatus.ACCEPTED,
    JobApplicationStatus.REJECTED,
  ],
  [JobApplicationStatus.ACCEPTED]: [],
  [JobApplicationStatus.REJECTED]: [],
};

export function getAllowedRecruitmentApplicationTransitions(
  currentStatus: JobApplicationStatus
): readonly JobApplicationStatus[] {
  return STATUS_TRANSITIONS[currentStatus];
}

export function canTransitionRecruitmentApplicationStatus(
  currentStatus: JobApplicationStatus,
  nextStatus: JobApplicationStatus
): boolean {
  return getAllowedRecruitmentApplicationTransitions(currentStatus).includes(
    nextStatus
  );
}

export function assertRecruitmentApplicationTransition(
  currentStatus: JobApplicationStatus,
  nextStatus: JobApplicationStatus
): void {
  if (!canTransitionRecruitmentApplicationStatus(currentStatus, nextStatus)) {
    throw new Error(
      `Invalid application status transition: ${currentStatus} -> ${nextStatus}`
    );
  }
}

export function parseRecruitmentVacancyMetadata(
  value: unknown
): RecruitmentVacancyMetadata {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return recruitmentVacancyMetadataSchema.parse(parsed);
    } catch {
      return recruitmentVacancyMetadataSchema.parse({});
    }
  }

  if (value && typeof value === "object") {
    return recruitmentVacancyMetadataSchema.parse(value);
  }

  return recruitmentVacancyMetadataSchema.parse({});
}

export function parseRecruitmentApplicationReviewMetadata(
  value: unknown
): RecruitmentApplicationReviewMetadata {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return recruitmentApplicationReviewMetadataSchema.parse(parsed);
    } catch {
      return recruitmentApplicationReviewMetadataSchema.parse({});
    }
  }

  if (value && typeof value === "object") {
    return recruitmentApplicationReviewMetadataSchema.parse(value);
  }

  return recruitmentApplicationReviewMetadataSchema.parse({});
}

export function buildRecruitmentApplicationReviewMetadata(
  input: Partial<RecruitmentApplicationReviewUpdateInput>,
  existing?: unknown
): RecruitmentApplicationReviewMetadata {
  const current = parseRecruitmentApplicationReviewMetadata(existing);

  return recruitmentApplicationReviewMetadataSchema.parse({
    ...current,
    ...input,
  });
}

export function serializeRecruitmentApplicationReviewMetadata(
  metadata: RecruitmentApplicationReviewMetadata
): string | null {
  const normalized = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );

  return Object.keys(normalized).length > 0 ? JSON.stringify(normalized) : null;
}

function metadataValue<T>(
  inputValue: T | undefined,
  currentValue: T | undefined,
  fallbackValue: T
): T {
  return inputValue ?? currentValue ?? fallbackValue;
}

export function buildRecruitmentVacancyMetadata(
  input: Partial<RecruitmentVacancyUpsertInput>,
  existing?: unknown
): RecruitmentVacancyMetadata {
  const current = parseRecruitmentVacancyMetadata(existing);

  return recruitmentVacancyMetadataSchema.parse({
    ...current,
    company: metadataValue(input.company, current.company, null),
    employment_type: metadataValue(
      input.employment_type,
      current.employment_type,
      null
    ),
    paid: metadataValue(input.paid, current.paid, false),
    short_description: metadataValue(
      input.short_description,
      current.short_description,
      null
    ),
    location: metadataValue(input.location, current.location, null),
    application_deadline: metadataValue(
      input.application_deadline,
      current.application_deadline,
      null
    ),
    contact_name: metadataValue(input.contact_name, current.contact_name, null),
    contact_email: metadataValue(
      input.contact_email,
      current.contact_email,
      null
    ),
    cv_required: metadataValue(input.cv_required, current.cv_required, false),
    tags: metadataValue(input.tags, current.tags, []),
    commitment: metadataValue(input.commitment, current.commitment, null),
    term: metadataValue(input.term, current.term, null),
    start_date: metadataValue(input.start_date, current.start_date, null),
    audience: metadataValue(input.audience, current.audience, null),
    contact_role: metadataValue(input.contact_role, current.contact_role, null),
    cover_pattern: metadataValue(
      input.cover_pattern,
      current.cover_pattern,
      null
    ),
    cover_image_file_id: metadataValue(
      input.cover_image_file_id,
      current.cover_image_file_id,
      null
    ),
    cover_image_url: metadataValue(
      input.cover_image_url,
      current.cover_image_url,
      null
    ),
    auto_translate: metadataValue(
      input.auto_translate,
      current.auto_translate,
      false
    ),
    push_to_inboxes: metadataValue(
      input.push_to_inboxes,
      current.push_to_inboxes,
      false
    ),
    newsletter: metadataValue(input.newsletter, current.newsletter, false),
    publication_mode: metadataValue(
      input.publication_mode,
      current.publication_mode,
      null
    ),
    scheduled_publish_at: metadataValue(
      input.scheduled_publish_at,
      current.scheduled_publish_at,
      null
    ),
  });
}

export function serializeRecruitmentVacancyMetadata(
  metadata: RecruitmentVacancyMetadata
): string | null {
  const normalized = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  );

  return Object.keys(normalized).length > 0 ? JSON.stringify(normalized) : null;
}

export function getRecruitmentVacancyCloseDate(
  metadata: RecruitmentVacancyMetadata,
  now: Date = new Date()
): Date {
  if (metadata.application_deadline) {
    const deadline = new Date(metadata.application_deadline);
    if (!Number.isNaN(deadline.getTime())) {
      return deadline;
    }
  }

  return now;
}

export function computeRecruitmentRetentionUntil(
  metadata: RecruitmentVacancyMetadata,
  now: Date = new Date()
): string {
  const closeDate = getRecruitmentVacancyCloseDate(metadata, now);
  const retentionUntil = new Date(closeDate);
  retentionUntil.setUTCDate(
    retentionUntil.getUTCDate() + RECRUITMENT_RETENTION_DAYS
  );

  return retentionUntil.toISOString();
}

export function isRecruitmentVacancyOpen(
  status: JobStatus,
  metadata: RecruitmentVacancyMetadata,
  now: Date = new Date()
): boolean {
  if (status !== JobStatus.PUBLISHED) {
    return false;
  }

  if (!metadata.application_deadline) {
    return true;
  }

  const deadline = new Date(metadata.application_deadline);
  if (Number.isNaN(deadline.getTime())) {
    return true;
  }

  return deadline.getTime() >= now.getTime();
}

export function validateRecruitmentResumeFile(file: File): void {
  if (file.size > RECRUITMENT_MAX_RESUME_BYTES) {
    throw new Error("Resume file is too large");
  }

  if (!RECRUITMENT_ALLOWED_RESUME_MIME_TYPES.includes(file.type as never)) {
    throw new Error("Resume must be a PDF file");
  }
}

// ---------------------------------------------------------------------------
// AI screening
// ---------------------------------------------------------------------------

export const recruitmentAiDimensionScoreSchema = z.object({
  name: z.string().trim().min(1).max(120),
  score: z.number().int().min(1).max(5),
  reason: z.string().trim().min(1).max(500),
});

export type RecruitmentAiDimensionScore = z.infer<
  typeof recruitmentAiDimensionScoreSchema
>;

export const recruitmentAiScreeningSchema = z.object({
  overall_score: z.number().int().min(1).max(5),
  normalized_score: z.number().int().min(0).max(100),
  recommended_status: z.enum(["reviewed", "interview", "rejected"]),
  summary: z.string().trim().min(1).max(2000),
  dimension_scores: z.array(recruitmentAiDimensionScoreSchema).max(10),
  strengths: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  concerns: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  red_flags: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  must_have_matches: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  must_have_missing: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  generated_at: z.string(),
  model: z.string().trim().min(1).max(120),
  version: z.literal(1).default(1),
});

export type RecruitmentAiScreening = z.infer<typeof recruitmentAiScreeningSchema>;

export function parseRecruitmentAiScreening(
  value: unknown
): RecruitmentAiScreening | null {
  if (value == null) {
    return null;
  }
  const raw = typeof value === "string" ? safeJsonParse(value) : value;
  const parsed = recruitmentAiScreeningSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function serializeRecruitmentAiScreening(
  screening: RecruitmentAiScreening
): string {
  return JSON.stringify(screening);
}

// ---------------------------------------------------------------------------
// Interviews, participants & scorecards
// ---------------------------------------------------------------------------

export const recruitmentInterviewParticipantInputSchema = z.object({
  user_id: nullableTrimmedString(50),
  email: z.email(),
  display_name: nullableTrimmedString(200),
  role: z.enum(["interviewer", "candidate", "observer"]).default("interviewer"),
  is_lead: z.boolean().optional().default(false),
});

export type RecruitmentInterviewParticipantInput = z.infer<
  typeof recruitmentInterviewParticipantInputSchema
>;

export const recruitmentInterviewCreateSchema = z.object({
  application_id: z.string().trim().min(1).max(50),
  round: z.number().int().min(1).max(20).default(1),
  title: z.string().trim().min(1).max(200),
  starts_at: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid start time"),
  ends_at: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid end time"),
  timezone: z.string().trim().min(1).max(50).default("Europe/Oslo"),
  location: nullableTrimmedString(200),
  meeting_url: nullableTrimmedString(1000),
  notes: nullableTrimmedString(4000),
  participants: z
    .array(recruitmentInterviewParticipantInputSchema)
    .min(1)
    .max(10),
  auto_create_teams_meeting: z.boolean().optional().default(true),
});

export type RecruitmentInterviewCreateInput = z.infer<
  typeof recruitmentInterviewCreateSchema
>;

export const recruitmentInterviewUpdateSchema =
  recruitmentInterviewCreateSchema.partial().extend({
    status: recruitmentNewInterviewStatusSchema.optional(),
    cancelled_reason: nullableTrimmedString(500),
  });

export type RecruitmentInterviewUpdateInput = z.infer<
  typeof recruitmentInterviewUpdateSchema
>;

export const recruitmentScorecardCriterionSchema = z.object({
  key: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(200),
  score: z.number().int().min(1).max(5).nullable().optional(),
  comment: nullableTrimmedString(1000),
});

export type RecruitmentScorecardCriterion = z.infer<
  typeof recruitmentScorecardCriterionSchema
>;

export const recruitmentScorecardSubmitSchema = z.object({
  interview_id: z.string().trim().min(1).max(50),
  overall_score: z.number().int().min(1).max(5),
  recommendation: recruitmentRecommendationSchema,
  criteria: z.array(recruitmentScorecardCriterionSchema).max(20).default([]),
  strengths: nullableTrimmedString(2000),
  concerns: nullableTrimmedString(2000),
  private_notes: nullableTrimmedString(4000),
});

export type RecruitmentScorecardSubmitInput = z.infer<
  typeof recruitmentScorecardSubmitSchema
>;

export function parseScorecardCriteria(
  value: unknown
): RecruitmentScorecardCriterion[] {
  if (value == null) {
    return [];
  }
  const raw = typeof value === "string" ? safeJsonParse(value) : value;
  const parsed = z
    .array(recruitmentScorecardCriterionSchema)
    .safeParse(raw);
  return parsed.success ? parsed.data : [];
}

// ---------------------------------------------------------------------------
// Candidate profile
// ---------------------------------------------------------------------------

export const recruitmentCandidateProfileUpsertSchema = z.object({
  email: z.email(),
  full_name: z.string().trim().min(1).max(200),
  phone: nullableTrimmedString(20),
  linkedin_url: nullableTrimmedString(500),
  current_role: nullableTrimmedString(200),
  current_employer: nullableTrimmedString(200),
  campus_id: nullableTrimmedString(50),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  notes: nullableTrimmedString(8000),
  source: nullableTrimmedString(100),
});

export type RecruitmentCandidateProfileUpsertInput = z.infer<
  typeof recruitmentCandidateProfileUpsertSchema
>;

// ---------------------------------------------------------------------------
// Booking token
// ---------------------------------------------------------------------------

export const RECRUITMENT_BOOKING_TOKEN_DEFAULT_TTL_DAYS = 14;

export const recruitmentBookingProposeSchema = z.object({
  application_id: z.string().trim().min(1).max(50),
  panel_user_ids: z
    .array(z.string().trim().min(1).max(50))
    .min(1)
    .max(10),
  duration_minutes: z.number().int().min(15).max(240).default(30),
  window_from: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid window start"),
  window_to: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid window end"),
  expires_in_days: z
    .number()
    .int()
    .min(1)
    .max(60)
    .default(RECRUITMENT_BOOKING_TOKEN_DEFAULT_TTL_DAYS),
});

export type RecruitmentBookingProposeInput = z.infer<
  typeof recruitmentBookingProposeSchema
>;

export const recruitmentBookingConfirmSchema = z.object({
  token: z.string().trim().min(1).max(200),
  starts_at: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid start time"),
  duration_minutes: z.number().int().min(15).max(240),
});

export type RecruitmentBookingConfirmInput = z.infer<
  typeof recruitmentBookingConfirmSchema
>;

// ---------------------------------------------------------------------------
// AI email drafts (cached on review metadata)
// ---------------------------------------------------------------------------

export const recruitmentAiEmailDraftSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(8000),
  locale: z.enum(["no", "en"]),
  generated_at: z.string(),
  model: z.string().trim().min(1).max(120),
});

export type RecruitmentAiEmailDraft = z.infer<
  typeof recruitmentAiEmailDraftSchema
>;
