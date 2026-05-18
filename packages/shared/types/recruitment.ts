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
});

export type RecruitmentVacancyUpsertInput = z.infer<
  typeof recruitmentVacancyUpsertSchema
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
