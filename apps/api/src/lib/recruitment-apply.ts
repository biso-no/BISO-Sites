import {
  normalizeScreeningScore,
  screenApplication,
} from "@repo/ai/server/recruitment-screener";
import { ID, type Models, Query } from "@repo/api";
import { InputFile } from "@repo/api/file";
import { createAdminClient } from "@repo/api/server";
import type {
  CandidateProfiles,
  JobApplicationAnswers,
} from "@repo/api/types/appwrite";
import {
  CandidateProfilesEmbeddingStatus,
  JobApplicationsEmbeddingStatus,
  JobApplicationsStatus,
} from "@repo/api/types/appwrite";
import type { CandidateProfileWriteInput } from "@repo/api/types/inputs";
import { createTypedRow, updateTypedRow } from "@repo/api/write";
import {
  buildRecruitmentStaffRowPermissions,
  getRecruitmentJobById,
} from "@repo/shared/recruitment";
import {
  buildRecruitmentApplicationReviewMetadata,
  computeRecruitmentRetentionUntil,
  isRecruitmentVacancyOpen,
  parseRecruitmentScreeningRubric,
  RECRUITMENT_RESUME_BUCKET_ID,
  type RecruitmentApplicationAnswerInput,
  type RecruitmentApplicationSubmitInput,
  type RecruitmentCustomQuestion,
  type RecruitmentVacancy,
  recruitmentApplicationSubmitSchema,
  serializeRecruitmentAiScreening,
  serializeRecruitmentApplicationReviewMetadata,
  validateRecruitmentResumeFile,
} from "@repo/shared/types/recruitment";
import { after } from "next/server";

const AVAILABILITY_SPLIT_PATTERN = /\r?\n|,/;
const MAX_AVAILABILITY_SLOTS = 12;

export type SubmitApplicationResult =
  | { ok: true; applicationId: string }
  | { ok: false; status: number; error: string };

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

function assertRequiredAnswersPresent(
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
    .slice(0, MAX_AVAILABILITY_SLOTS);
}

async function upsertCandidateProfile(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  vacancy: RecruitmentVacancy,
  parsedData: RecruitmentApplicationSubmitInput,
  email: string,
  consentDate: Date,
  retentionUntil: string
): Promise<string | null> {
  try {
    const existing = await db.listRows<CandidateProfiles>(
      "app",
      "candidate_profiles",
      [Query.equal("email", email), Query.limit(1)]
    );
    if (existing.rows[0]) {
      const cur = existing.rows[0];
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
          current_employer: parsedData.current_employer ?? cur.current_employer,
          current_role: parsedData.current_role ?? cur.current_role,
          data_retention_until: retentionUntil,
          full_name:
            parsedData.applicant_name.length > 0
              ? parsedData.applicant_name
              : cur.full_name,
          last_application_at: consentDate.toISOString(),
          linkedin_url: parsedData.linkedin_url ?? cur.linkedin_url ?? null,
          phone: parsedData.applicant_phone ?? cur.phone ?? null,
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
        current_employer: parsedData.current_employer ?? null,
        current_role: parsedData.current_role ?? null,
        data_retention_until: retentionUntil,
        email,
        embedding_id: null,
        embedding_status: CandidateProfilesEmbeddingStatus.PENDING,
        full_name: parsedData.applicant_name,
        gdpr_consent: true,
        last_application_at: consentDate.toISOString(),
        linkedin_url: parsedData.linkedin_url ?? null,
        notes: null,
        phone: parsedData.applicant_phone ?? null,
        source: "mobile_apply",
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

async function persistAnswers(
  db: Awaited<ReturnType<typeof createAdminClient>>["db"],
  applicationId: string,
  jobId: string,
  answers: RecruitmentApplicationAnswerInput[]
): Promise<void> {
  for (const answer of answers) {
    try {
      await db.createRow<JobApplicationAnswers>(
        "app",
        "job_application_answers",
        ID.unique(),
        {
          answer: answer.answer ?? null,
          answer_type:
            answer.answer_type as JobApplicationAnswers["answer_type"],

          // @ts-expect-error relationship column not part of the generated row type
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

function scheduleAiScreening(
  vacancy: RecruitmentVacancy,
  applicationId: string,
  parsedData: RecruitmentApplicationSubmitInput,
  email: string
): void {
  const autoScreen =
    vacancy.auto_screen !== false &&
    vacancy.metadata.auto_screen !== false &&
    Boolean(process.env.OPENAI_API_KEY);
  if (!autoScreen) {
    return;
  }
  after(async () => {
    try {
      const { db: afterDb } = await createAdminClient();
      const screening = await screenApplication({
        answers: (parsedData.answers ?? []).map((a) => ({
          answer: a.answer ?? null,
          question_label: a.question_label,
        })),
        application: {
          $id: applicationId,
          applicant_email: email,
          applicant_name: parsedData.applicant_name,
          cover_letter: parsedData.cover_letter ?? null,
          current_employer: parsedData.current_employer ?? null,
          current_role: parsedData.current_role ?? null,
          linkedin_url: parsedData.linkedin_url ?? null,
        },
        rubric:
          vacancy.screening_rubric ?? parseRecruitmentScreeningRubric(null),
        vacancy: {
          $id: vacancy.$id,
          metadata: vacancy.metadata,
          translations: vacancy.translations,
        },
      });
      await afterDb.updateRow("app", "job_applications", applicationId, {
        ai_screening: serializeRecruitmentAiScreening(screening),
        screening_score: normalizeScreeningScore(screening),
      });
    } catch (err) {
      console.warn(
        `AI screening failed for application ${applicationId}:`,
        err
      );
    }
  });
}

export async function submitRecruitmentApplication(
  jobId: string,
  formData: FormData,
  user: Models.User<Models.Preferences>
): Promise<SubmitApplicationResult> {
  const answers = readCustomAnswers(formData);
  const parsed = recruitmentApplicationSubmitSchema.safeParse({
    applicant_name: formData.get("applicant_name"),
    applicant_email: user.email,
    applicant_phone: formData.get("applicant_phone"),
    answers,
    candidate_availability: readAvailabilitySlots(formData),
    cover_letter: formData.get("cover_letter"),
    current_employer: formData.get("current_employer"),
    current_role: formData.get("current_role"),
    gdpr_consent:
      formData.get("gdpr_consent") === "true" ||
      formData.get("gdpr_consent") === "on",
    linkedin_url: formData.get("linkedin_url"),
  });

  if (!parsed.success) {
    return { ok: false, status: 400, error: "Invalid application data." };
  }

  const { db, storage } = await createAdminClient();
  const vacancy = await getRecruitmentJobById(db, jobId);
  if (
    !(
      vacancy &&
      isRecruitmentVacancyOpen(vacancy.status, vacancy.application_deadline)
    )
  ) {
    return {
      ok: false,
      status: 409,
      error: "This vacancy is not accepting applications.",
    };
  }

  const missingAnswerError = assertRequiredAnswersPresent(
    vacancy.custom_questions,
    parsed.data.answers ?? []
  );
  if (missingAnswerError) {
    return { ok: false, status: 400, error: missingAnswerError };
  }

  const existing = await db.listRows("app", "job_applications", [
    Query.equal("job_id", jobId),
    Query.equal("applicant_email", user.email),
    Query.limit(1),
  ]);
  if (existing.total > 0) {
    return {
      ok: false,
      status: 409,
      error: "You have already applied for this vacancy.",
    };
  }

  const resume = formData.get("resume");
  let resumeFileId: string | null = null;
  if (resume instanceof File && resume.size > 0) {
    try {
      validateRecruitmentResumeFile(resume);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid resume file";
      return { ok: false, status: 400, error: message };
    }
    const buffer = Buffer.from(await resume.arrayBuffer());
    const uploaded = await storage.createFile(
      RECRUITMENT_RESUME_BUCKET_ID,
      ID.unique(),
      InputFile.fromBuffer(buffer, resume.name)
    );
    resumeFileId = uploaded.$id;
  } else if (vacancy.metadata.cv_required) {
    return {
      ok: false,
      status: 400,
      error: "A CV is required for this vacancy.",
    };
  }

  const consentDate = new Date();
  const retentionUntil = computeRecruitmentRetentionUntil(
    vacancy.application_deadline
  );

  const candidateProfileId = await upsertCandidateProfile(
    db,
    vacancy,
    parsed.data,
    user.email,
    consentDate,
    retentionUntil
  );

  const application = await db.createRow(
    "app",
    "job_applications",
    ID.unique(),
    {
      applicant_email: user.email,
      applicant_name: parsed.data.applicant_name,
      applicant_phone: parsed.data.applicant_phone ?? null,
      candidate_profile: candidateProfileId,
      candidate_profile_id: candidateProfileId,
      consent_date: consentDate.toISOString(),
      cover_letter: parsed.data.cover_letter ?? null,
      data_processing_purpose: "BISO recruitment process",
      data_retention_until: retentionUntil,
      embedding_status: JobApplicationsEmbeddingStatus.PENDING,
      gdpr_consent: true,
      job: jobId,
      job_id: jobId,
      resume_file_id: resumeFileId,
      review_metadata: serializeRecruitmentApplicationReviewMetadata(
        buildRecruitmentApplicationReviewMetadata({
          candidate_availability: parsed.data.candidate_availability,
        })
      ),
      source: "mobile_apply",
      status: JobApplicationsStatus.SUBMITTED,
    },
    buildRecruitmentStaffRowPermissions()
  );

  await persistAnswers(db, application.$id, jobId, parsed.data.answers ?? []);
  scheduleAiScreening(vacancy, application.$id, parsed.data, user.email);

  return { ok: true, applicationId: application.$id };
}
