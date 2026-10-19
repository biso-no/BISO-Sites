// Applying for a vacancy and listing one's own applications: the flow behind
// both the website's apply form (`submitJobApplication` in apps/web) and the
// app's `/api/recruitment/applications` route in apps/api.
//
// Deliberately NOT a "use server" module: it takes the applicant's identity as
// an argument and writes with the admin key, so it must never be reachable as
// a server action. Callers authenticate the applicant first. AI functions are
// passed in because `@repo/ai` depends on this package, not the other way.

import "server-only";

import { ID, Query } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient } from "@repo/api/server";
import type {
  CandidateProfiles,
  JobApplicationAnswers,
  JobApplications,
  JobInterviews,
  Jobs,
} from "@repo/api/types/appwrite";
import {
  CandidateProfilesEmbeddingStatus,
  JobApplicationsEmbeddingStatus,
  JobApplicationsStatus,
} from "@repo/api/types/appwrite";
import type {
  CandidateProfileWriteInput,
  JobApplicationAnswerWriteInput,
} from "@repo/api/types/inputs";
import { createTypedRow, updateTypedRow } from "@repo/api/write";
import {
  buildRecruitmentStaffRowPermissions,
  getRecruitmentJobById,
} from "@repo/shared/recruitment";
import {
  coverLetterTextForScreening,
  pdfStorageName,
  validateApplicationDocument,
} from "@repo/shared/recruitment/application-documents";
import {
  buildRecruitmentApplicationReviewMetadata,
  computeRecruitmentRetentionUntil,
  isRecruitmentVacancyOpen,
  parseRecruitmentApplicationReviewMetadata,
  parseRecruitmentScreeningRubric,
  RECRUITMENT_RESUME_BUCKET_ID,
  type RecruitmentAiScreening,
  type RecruitmentApplicationAnswerInput,
  type RecruitmentApplicationSubmitInput,
  type RecruitmentCustomQuestion,
  type RecruitmentScreeningRubric,
  type RecruitmentVacancy,
  recruitmentApplicationSubmitSchema,
  serializeRecruitmentAiScreening,
  serializeRecruitmentApplicationReviewMetadata,
  validateRecruitmentResumeFile,
} from "@repo/shared/types/recruitment";

export type RecruitmentApplyErrorCode =
  | "invalid_data"
  | "vacancy_closed"
  | "members_only"
  | "answer_required"
  | "already_applied"
  | "cv_required"
  | "cover_letter_required"
  | "invalid_file"
  | "submit_failed";

/** The signed-in applicant, as the caller's session or JWT established it. */
export interface RecruitmentApplicant {
  email: string;
  /** Used when the form leaves the name blank. */
  name?: string | null;
  userId: string;
}

export interface RecruitmentApplyDeps {
  extractPdfText: (pdf: Buffer) => Promise<string>;
  /** Called only for a members-only vacancy. */
  isMember: () => Promise<boolean>;
}

type ScreeningVacancy = Pick<
  RecruitmentVacancy,
  "$id" | "metadata" | "translations"
>;

interface ScreeningAnswer {
  answer: string | null;
  question_label: string;
}

/**
 * What `screenApplication` in `@repo/ai/server/recruitment-screener` takes,
 * typed structurally here because this package cannot import `@repo/ai`.
 */
export interface RecruitmentScreeningInput {
  answers?: ScreeningAnswer[];
  application: {
    $id: string;
    applicant_name: string;
    cover_letter: string | null;
    current_role?: string | null;
  };
  resumeText?: string | null;
  rubric?: RecruitmentScreeningRubric | null;
  vacancy: ScreeningVacancy;
}

export type RecruitmentScreener = (
  input: RecruitmentScreeningInput
) => Promise<RecruitmentAiScreening>;

/**
 * Everything AI screening needs after the response has gone. Callers run it
 * with `runRecruitmentScreening` inside `after()`.
 */
export interface RecruitmentScreeningJob {
  answers: ScreeningAnswer[];
  applicantName: string;
  applicationId: string;
  coverLetterText: string | null;
  currentRole: string | null;
  extractPdfText: (pdf: Buffer) => Promise<string>;
  resume: Buffer | null;
  rubric: RecruitmentScreeningRubric;
  vacancy: ScreeningVacancy;
}

export type RecruitmentApplyResult =
  | {
      success: true;
      applicationId: string;
      /** Null when auto-screening is off for the vacancy or unconfigured. */
      screening: RecruitmentScreeningJob | null;
    }
  | { success: false; code: RecruitmentApplyErrorCode; error: string };

type RecruitmentApplyFailure = Extract<
  RecruitmentApplyResult,
  { success: false }
>;

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>;
type AdminDb = AdminClient["db"];

/** `job_applications.applicant_phone` and `candidate_profiles.phone` are size 20. */
const MAX_PHONE_LENGTH = 20;
const AVAILABILITY_SPLIT_PATTERN = /\r?\n|,/;

function failure(
  code: RecruitmentApplyErrorCode,
  error: string
): RecruitmentApplyFailure {
  return { code, error, success: false };
}

function readCustomAnswers(
  formData: FormData
): RecruitmentApplicationAnswerInput[] {
  const answers: RecruitmentApplicationAnswerInput[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("answer.")) {
      continue;
    }
    const questionId = key.slice("answer.".length);
    const rawType = formData.get(`answer_type.${questionId}`);
    const rawLabel = formData.get(`answer_label.${questionId}`);
    const stringValue = typeof value === "string" ? value : "";
    answers.push({
      answer: stringValue.length > 0 ? stringValue : null,
      answer_type: (typeof rawType === "string"
        ? rawType
        : "text") as RecruitmentApplicationAnswerInput["answer_type"],
      question_id: questionId,
      question_label:
        typeof rawLabel === "string" && rawLabel.trim().length > 0
          ? rawLabel
          : questionId,
    });
  }
  return answers;
}

function missingRequiredAnswer(
  vacancyQuestions: RecruitmentCustomQuestion[],
  answers: RecruitmentApplicationAnswerInput[]
): string | null {
  const answersById = new Map(answers.map((a) => [a.question_id, a.answer]));
  for (const q of vacancyQuestions) {
    if (!q.required) {
      continue;
    }
    const val = answersById.get(q.id);
    if (!val || val.trim().length === 0) {
      return `Answer required for "${q.label}"`;
    }
  }
  return null;
}

function readAvailabilitySlots(formData: FormData): string[] {
  const repeated = formData
    .getAll("candidate_availability")
    .filter((v): v is string => typeof v === "string");
  const textarea =
    typeof formData.get("availability") === "string"
      ? String(formData.get("availability"))
          .split(AVAILABILITY_SPLIT_PATTERN)
          .map((s) => s.trim())
      : [];
  return [...repeated, ...textarea]
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function readApplicantName(
  formData: FormData,
  applicant: RecruitmentApplicant
): unknown {
  const fromForm = formData.get("applicant_name");
  if (typeof fromForm === "string" && fromForm.trim().length > 0) {
    return fromForm;
  }
  return applicant.name ?? fromForm;
}

function parseApplication(
  applicant: RecruitmentApplicant,
  formData: FormData
): RecruitmentApplicationSubmitInput | RecruitmentApplyFailure {
  const parsed = recruitmentApplicationSubmitSchema.safeParse({
    applicant_name: readApplicantName(formData, applicant),
    applicant_email: applicant.email,
    applicant_phone: formData.get("applicant_phone"),
    answers: readCustomAnswers(formData),
    candidate_availability: readAvailabilitySlots(formData),
    // The text field is gone; the PDF's text is filled in after upload.
    cover_letter: null,
    current_employer: formData.get("current_employer"),
    current_role: formData.get("current_role"),
    gdpr_consent:
      formData.get("gdpr_consent") === "true" ||
      formData.get("gdpr_consent") === "on",
    linkedin_url: formData.get("linkedin_url"),
  });
  if (!parsed.success) {
    return failure("invalid_data", "Invalid application data.");
  }
  // The schema allows 50 characters; the columns hold 20. Caught here, a long
  // number is a clear message instead of a failed row write after upload.
  if ((parsed.data.applicant_phone?.length ?? 0) > MAX_PHONE_LENGTH) {
    return failure(
      "invalid_data",
      `The phone number can be at most ${MAX_PHONE_LENGTH} characters.`
    );
  }
  return parsed.data;
}

/** The validator's message when a document is rejected, or null. */
function documentProblem(
  validate: (file: File) => void,
  file: File
): string | null {
  try {
    validate(file);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid file.";
  }
}

interface ApplicationDocuments {
  coverLetter: File;
  resume: File | null;
}

/**
 * Both documents are checked before either is uploaded: a rejection after an
 * upload would leave a file in the bucket that no row points at, which the
 * retention cleanup never reclaims.
 */
function readDocuments(
  formData: FormData,
  vacancy: RecruitmentVacancy
): ApplicationDocuments | RecruitmentApplyFailure {
  const resume = formData.get("resume");
  const hasResume = resume instanceof File && resume.size > 0;
  if (hasResume) {
    const problem = documentProblem(validateRecruitmentResumeFile, resume);
    if (problem) {
      return failure("invalid_file", problem);
    }
  } else if (vacancy.metadata.cv_required) {
    return failure("cv_required", "A CV is required for this vacancy.");
  }
  // The cover letter is a required PDF. Its text is kept on the row for the
  // screener and the admin drawer; the file is stored next to the CV.
  const coverLetter = formData.get("cover_letter");
  if (!(coverLetter instanceof File && coverLetter.size > 0)) {
    return failure(
      "cover_letter_required",
      "A cover letter (PDF) is required."
    );
  }
  const problem = documentProblem(validateApplicationDocument, coverLetter);
  if (problem) {
    return failure("invalid_file", problem);
  }
  return { coverLetter, resume: hasResume ? resume : null };
}

interface StoredDocuments {
  coverLetterFileId: string;
  coverLetterText: string | null;
  resumeBuffer: Buffer | null;
  resumeFileId: string | null;
}

async function uploadDocuments(
  storage: AdminClient["storage"],
  documents: ApplicationDocuments,
  extractPdfText: RecruitmentApplyDeps["extractPdfText"]
): Promise<StoredDocuments> {
  let resumeFileId: string | null = null;
  let resumeBuffer: Buffer | null = null;
  if (documents.resume) {
    resumeBuffer = Buffer.from(await documents.resume.arrayBuffer());
    const uploaded = await storage.createFile(
      RECRUITMENT_RESUME_BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(
        resumeBuffer,
        pdfStorageName(documents.resume.name, "cv")
      )
    );
    resumeFileId = uploaded.$id;
  }

  const coverLetterBuffer = Buffer.from(
    await documents.coverLetter.arrayBuffer()
  );
  const coverLetterUpload = await storage.createFile(
    RECRUITMENT_RESUME_BUCKET_ID,
    ID.unique(),
    InputFile.fromBuffer(
      coverLetterBuffer,
      pdfStorageName(documents.coverLetter.name, "cover-letter")
    )
  );
  const coverLetterText = coverLetterTextForScreening(
    await extractPdfText(coverLetterBuffer).catch((err: unknown) => {
      console.warn("Cover letter text extraction failed:", err);
      return null;
    })
  );

  return {
    coverLetterFileId: coverLetterUpload.$id,
    coverLetterText,
    resumeBuffer,
    resumeFileId,
  };
}

async function upsertCandidateProfile(
  db: AdminDb,
  email: string,
  application: RecruitmentApplicationSubmitInput,
  vacancy: RecruitmentVacancy,
  consentDate: Date,
  retentionUntil: string
): Promise<string | null> {
  try {
    const existing = await db.listRows<CandidateProfiles>(
      "app",
      "candidate_profiles",
      [Query.equal("email", email), Query.limit(1)]
    );
    const cur = existing.rows[0];
    if (cur) {
      const updated = await updateTypedRow<
        CandidateProfiles,
        Partial<CandidateProfileWriteInput>
      >(
        db,
        "app",
        "candidate_profiles",
        cur.$id,
        {
          applications_count: (cur.applications_count ?? 0) + 1,
          campus_id: vacancy.campus_id ?? cur.campus_id,
          current_employer:
            application.current_employer ?? cur.current_employer,
          current_role: application.current_role ?? cur.current_role,
          data_retention_until: retentionUntil,
          full_name:
            application.applicant_name.length > 0
              ? application.applicant_name
              : cur.full_name,
          last_application_at: consentDate.toISOString(),
          linkedin_url: application.linkedin_url ?? cur.linkedin_url ?? null,
          phone: application.applicant_phone ?? cur.phone ?? null,
        },
        buildRecruitmentStaffRowPermissions()
      );
      return updated.$id;
    }
    const created = await createTypedRow<
      CandidateProfiles,
      CandidateProfileWriteInput
    >(
      db,
      "app",
      "candidate_profiles",
      ID.unique(),
      {
        applications_count: 1,
        campus_id: vacancy.campus_id,
        consent_date: consentDate.toISOString(),
        current_employer: application.current_employer ?? null,
        current_role: application.current_role ?? null,
        data_retention_until: retentionUntil,
        email,
        embedding_id: null,
        embedding_status: CandidateProfilesEmbeddingStatus.PENDING,
        full_name: application.applicant_name,
        gdpr_consent: true,
        last_application_at: consentDate.toISOString(),
        linkedin_url: application.linkedin_url ?? null,
        notes: null,
        phone: application.applicant_phone ?? null,
        source: "public_apply",
        tags: null,
      },
      buildRecruitmentStaffRowPermissions()
    );
    return created.$id;
  } catch (err) {
    console.warn("Candidate profile upsert failed:", err);
    return null;
  }
}

async function storeAnswers(
  db: AdminDb,
  applicationId: string,
  jobId: string,
  answers: RecruitmentApplicationAnswerInput[]
): Promise<void> {
  for (const answer of answers) {
    try {
      await createTypedRow<
        JobApplicationAnswers,
        JobApplicationAnswerWriteInput
      >(
        db,
        "app",
        "job_application_answers",
        ID.unique(),
        {
          answer: answer.answer ?? null,
          answer_type:
            answer.answer_type as JobApplicationAnswers["answer_type"],
          application: applicationId,
          application_id: applicationId,
          job_id: jobId,
          question_id: answer.question_id,
          question_label: answer.question_label,
        },
        buildRecruitmentStaffRowPermissions()
      );
    } catch (err) {
      console.warn(`Failed to persist answer for ${answer.question_id}:`, err);
    }
  }
}

function isAutoScreened(vacancy: RecruitmentVacancy): boolean {
  return (
    vacancy.auto_screen !== false &&
    vacancy.metadata.auto_screen !== false &&
    Boolean(process.env.OPENAI_API_KEY)
  );
}

/**
 * Validates and stores one application: the CV and cover letter in the
 * `resumes` bucket, the candidate profile, the application row and its
 * answers, all readable by recruitment staff only. Every rejection carries a
 * `code`, and nothing is uploaded until every check has passed.
 */
export async function submitRecruitmentApplication(
  input: {
    applicant: RecruitmentApplicant;
    jobId: string;
    formData: FormData;
  },
  deps: RecruitmentApplyDeps
): Promise<RecruitmentApplyResult> {
  const { applicant, formData, jobId } = input;
  try {
    const application = parseApplication(applicant, formData);
    if ("code" in application) {
      return application;
    }

    const { db, storage } = await createAdminClient();
    const vacancy = await getRecruitmentJobById(db, jobId);
    if (
      !(
        vacancy &&
        isRecruitmentVacancyOpen(vacancy.status, vacancy.application_deadline)
      )
    ) {
      return failure(
        "vacancy_closed",
        "This vacancy is not accepting applications."
      );
    }

    // Members-only vacancies are visible to everyone — the gate is here, on
    // applying, not on reading the row. Callers check live (uncached) status:
    // a student who paid for their membership a moment ago must be able to
    // apply straight away, and this gate is the one thing that would tell
    // them otherwise.
    if (vacancy.metadata.audience === "members" && !(await deps.isMember())) {
      return failure(
        "members_only",
        "This vacancy is open to BISO members only. Buy a membership to apply."
      );
    }

    const answers = application.answers ?? [];
    const missingAnswer = missingRequiredAnswer(
      vacancy.custom_questions,
      answers
    );
    if (missingAnswer) {
      return failure("answer_required", missingAnswer);
    }

    const existing = await db.listRows("app", "job_applications", [
      Query.equal("job_id", jobId),
      Query.equal("applicant_email", applicant.email),
      Query.limit(1),
    ]);
    if (existing.total > 0) {
      return failure(
        "already_applied",
        "You have already applied for this vacancy."
      );
    }

    const documents = readDocuments(formData, vacancy);
    if ("code" in documents) {
      return documents;
    }
    const stored = await uploadDocuments(
      storage,
      documents,
      deps.extractPdfText
    );

    const consentDate = new Date();
    const retentionUntil = computeRecruitmentRetentionUntil(
      vacancy.application_deadline
    );
    const candidateProfileId = await upsertCandidateProfile(
      db,
      applicant.email,
      application,
      vacancy,
      consentDate,
      retentionUntil
    );

    // `cover_letter_file_id` is not in the generated row type yet, so this
    // write stays untyped.
    const row = await db.createRow(
      "app",
      "job_applications",
      ID.unique(),
      {
        applicant_email: applicant.email,
        applicant_name: application.applicant_name,
        applicant_phone: application.applicant_phone ?? null,
        candidate_profile: candidateProfileId,
        candidate_profile_id: candidateProfileId,
        consent_date: consentDate.toISOString(),
        cover_letter: stored.coverLetterText,
        cover_letter_file_id: stored.coverLetterFileId,
        data_processing_purpose: "BISO recruitment process",
        data_retention_until: retentionUntil,
        embedding_status: JobApplicationsEmbeddingStatus.PENDING,
        gdpr_consent: true,
        job: jobId,
        job_id: jobId,
        resume_file_id: stored.resumeFileId,
        review_metadata: serializeRecruitmentApplicationReviewMetadata(
          buildRecruitmentApplicationReviewMetadata({
            candidate_availability: application.candidate_availability,
          })
        ),
        source: "public_apply",
        status: JobApplicationsStatus.SUBMITTED,
      },
      buildRecruitmentStaffRowPermissions()
    );

    await storeAnswers(db, row.$id, jobId, answers);

    const screening: RecruitmentScreeningJob | null = isAutoScreened(vacancy)
      ? {
          answers: answers.map((a) => ({
            answer: a.answer ?? null,
            question_label: a.question_label,
          })),
          applicantName: application.applicant_name,
          applicationId: row.$id,
          coverLetterText: stored.coverLetterText,
          currentRole: application.current_role ?? null,
          extractPdfText: deps.extractPdfText,
          resume: stored.resumeBuffer,
          rubric:
            vacancy.screening_rubric ?? parseRecruitmentScreeningRubric(null),
          vacancy: {
            $id: vacancy.$id,
            metadata: vacancy.metadata,
            translations: vacancy.translations,
          },
        }
      : null;

    return { applicationId: row.$id, screening, success: true };
  } catch (error) {
    console.error("submitRecruitmentApplication failed:", error);
    return failure("submit_failed", "Failed to submit application.");
  }
}

/** Mirrors `normalizeScreeningScore` in `@repo/ai`, which this package cannot import. */
function screeningScore(screening: RecruitmentAiScreening): number {
  if (typeof screening.normalized_score === "number") {
    return Math.min(100, Math.max(0, Math.round(screening.normalized_score)));
  }
  return Math.round(((screening.overall_score - 1) / 4) * 100);
}

/**
 * Screens a stored application and writes the result onto its row. Never
 * throws: a failed screening leaves the application unscored for staff.
 */
export async function runRecruitmentScreening(
  job: RecruitmentScreeningJob,
  screen: RecruitmentScreener
): Promise<void> {
  try {
    // A fresh admin client: this runs after the response, outside the
    // request that submitted the application.
    const { db } = await createAdminClient();
    // A CV that fails to parse (scanned image, malformed PDF) should not
    // block screening — the model is told no CV was provided.
    const resumeText = job.resume
      ? await job.extractPdfText(job.resume).catch((err: unknown) => {
          console.warn(
            `CV text extraction failed for application ${job.applicationId}:`,
            err
          );
          return null;
        })
      : null;
    const screening = await screen({
      answers: job.answers,
      application: {
        $id: job.applicationId,
        applicant_name: job.applicantName,
        cover_letter: job.coverLetterText,
        current_role: job.currentRole,
      },
      resumeText,
      rubric: job.rubric,
      vacancy: job.vacancy,
    });
    await db.updateRow("app", "job_applications", job.applicationId, {
      ai_screening: serializeRecruitmentAiScreening(screening),
      screening_score: screeningScore(screening),
    });
  } catch (err) {
    console.warn(
      `AI screening failed for application ${job.applicationId}:`,
      err
    );
  }
}

// ---------- the applicant's own applications ----------

export interface MyApplicationView {
  $createdAt: string;
  $id: string;
  answers: Array<{ question_label: string; answer: string | null }>;
  cover_letter: string | null;
  data_retention_until: string;
  hr_assigned_name: string | null;
  job: {
    $id: string;
    slug: string;
    title: string;
    campus_name: string | null;
  } | null;
  next_interview: {
    $id: string;
    starts_at: string | null;
    ends_at: string | null;
    title: string;
    location: string | null;
    meeting_url: string | null;
    status: "proposed" | "scheduled" | "completed" | "cancelled" | "no_show";
  } | null;
  resume_file_id: string | null;
  status: "submitted" | "reviewed" | "interview" | "accepted" | "rejected";
}

/**
 * The applications filed under `email`, newest first, with each vacancy's
 * title, the next upcoming interview and the answers given. Throws when
 * Appwrite cannot be read — the caller decides what an outage shows.
 */
export async function listApplicationsForApplicant(
  email: string
): Promise<MyApplicationView[]> {
  const { db } = await createAdminClient();
  const apps = await db.listRows<JobApplications>("app", "job_applications", [
    Query.equal("applicant_email", email),
    Query.orderDesc("$createdAt"),
    Query.limit(50),
  ]);
  if (apps.rows.length === 0) {
    return [];
  }

  const jobIds = Array.from(
    new Set(apps.rows.map((a: JobApplications) => a.job_id))
  );
  const appIds = apps.rows.map((a: JobApplications) => a.$id);

  interface JobRow {
    $id: string;
    campus?: { name: string };
    slug: string;
    translations?: Array<{ locale?: string; title?: string }>;
  }
  const jobsResult = await db.listRows<Jobs>("app", "jobs", [
    Query.equal("$id", jobIds),
    Query.select([
      "$id",
      "slug",
      "campus.name",
      "translations.locale",
      "translations.title",
    ]),
    Query.limit(jobIds.length),
  ]);
  const jobById = new Map(jobsResult.rows.map((j: JobRow) => [j.$id, j]));

  const interviews = await db.listRows<JobInterviews>("app", "job_interviews", [
    Query.equal("application_id", appIds),
    Query.orderAsc("starts_at"),
    Query.limit(appIds.length * 3),
  ]);
  const nextByApp = new Map<string, JobInterviews>();
  const now = Date.now();
  for (const iv of interviews.rows) {
    if (iv.status === "cancelled") {
      continue;
    }
    const startsAt = iv.starts_at ? new Date(iv.starts_at).getTime() : 0;
    if (startsAt && startsAt < now) {
      continue;
    }
    const existing = nextByApp.get(iv.application_id);
    if (
      !existing ||
      (startsAt &&
        (!existing.starts_at ||
          startsAt < new Date(existing.starts_at).getTime()))
    ) {
      nextByApp.set(iv.application_id, iv);
    }
  }

  const answersResult = await db.listRows<JobApplicationAnswers>(
    "app",
    "job_application_answers",
    [Query.equal("application_id", appIds), Query.limit(200)]
  );
  const answersByApp = new Map<
    string,
    Array<{ question_label: string; answer: string | null }>
  >();
  for (const answerRow of answersResult.rows) {
    const list = answersByApp.get(answerRow.application_id) ?? [];
    list.push({
      answer: answerRow.answer ?? null,
      question_label: answerRow.question_label,
    });
    answersByApp.set(answerRow.application_id, list);
  }

  return apps.rows.map((app) => {
    const job = jobById.get(app.job_id);
    const translations = job?.translations ?? [];
    const title =
      translations.find((tr) => tr.locale === "no")?.title ??
      translations[0]?.title ??
      job?.slug ??
      "Vacancy";
    const next = nextByApp.get(app.$id) ?? null;
    const review = parseRecruitmentApplicationReviewMetadata(
      app.review_metadata
    );

    return {
      $createdAt: app.$createdAt,
      $id: app.$id,
      answers: answersByApp.get(app.$id) ?? [],
      cover_letter: app.cover_letter ?? null,
      data_retention_until: app.data_retention_until,
      hr_assigned_name: review.assigned_hr_user_name ?? null,
      job: job
        ? {
            $id: job.$id,
            campus_name: job.campus?.name ?? null,
            slug: job.slug,
            title,
          }
        : null,
      next_interview: next
        ? {
            $id: next.$id,
            ends_at: next.ends_at,
            location: next.location,
            meeting_url: next.meeting_url,
            starts_at: next.starts_at,
            status: next.status,
            title: next.title,
          }
        : null,
      resume_file_id: app.resume_file_id ?? null,
      status: app.status,
    };
  });
}
