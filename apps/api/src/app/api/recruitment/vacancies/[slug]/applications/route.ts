import { ID, InputFile, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import {
  EmbeddingStatus,
  JobApplicationStatus,
} from "@repo/api/types/appwrite";
import type {
  CandidateProfiles,
  JobApplicationAnswers,
} from "@repo/api/types/appwrite";
import {
  buildRecruitmentApplicationReviewMetadata,
  computeRecruitmentRetentionUntil,
  isRecruitmentVacancyOpen,
  RECRUITMENT_RESUME_BUCKET_ID,
  type RecruitmentApplicationAnswerInput,
  type RecruitmentCustomQuestion,
  recruitmentApplicationSubmitSchema,
  serializeRecruitmentApplicationReviewMetadata,
  validateRecruitmentResumeFile,
} from "@repo/shared/types/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import {
  getRecruitmentJobById,
  isAuthenticatedAppwriteUser,
} from "@/lib/recruitment";

const AVAILABILITY_SPLIT_PATTERN = /\r?\n|,/;

function toBoolean(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") {
    return false;
  }

  return value === "true" || value === "on";
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
    const labelKey = `answer_label.${questionId}`;
    const typeKey = `answer_type.${questionId}`;
    const rawType = formData.get(typeKey);
    const rawLabel = formData.get(labelKey);
    const stringValue = typeof value === "string" ? value : "";
    const answerType = typeof rawType === "string" ? rawType : "text";
    answers.push({
      answer: stringValue.length > 0 ? stringValue : null,
      answer_type:
        answerType as RecruitmentApplicationAnswerInput["answer_type"],
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
  const answersById = new Map(
    answers.map((answer) => [answer.question_id, answer.answer])
  );
  for (const question of vacancyQuestions) {
    if (!question.required) {
      continue;
    }
    const value = answersById.get(question.id);
    if (!value || value.trim().length === 0) {
      return `Answer required for "${question.label}"`;
    }
  }
  return null;
}

function readAvailabilitySlots(formData: FormData): string[] {
  const repeatedSlots = formData
    .getAll("candidate_availability")
    .filter((value): value is string => typeof value === "string");
  const textareaSlots =
    typeof formData.get("availability") === "string"
      ? String(formData.get("availability"))
          .split(AVAILABILITY_SPLIT_PATTERN)
          .map((slot) => slot.trim())
      : [];

  return [...repeatedSlots, ...textareaSlots]
    .map((slot) => slot.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  try {
    const { slug: jobId } = await context.params;
    const { account } = await createAuthenticatedClient(request);
    const user = await account.get();

    if (!(isAuthenticatedAppwriteUser(user) && user.email)) {
      return NextResponse.json(
        { error: "A signed-in account is required to apply" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const parsed = recruitmentApplicationSubmitSchema.safeParse({
      applicant_name: formData.get("applicant_name"),
      applicant_email: formData.get("applicant_email"),
      applicant_phone: formData.get("applicant_phone"),
      answers: readCustomAnswers(formData),
      candidate_availability: readAvailabilitySlots(formData),
      cover_letter: formData.get("cover_letter"),
      current_employer: formData.get("current_employer"),
      current_role: formData.get("current_role"),
      gdpr_consent: toBoolean(formData.get("gdpr_consent")),
      linkedin_url: formData.get("linkedin_url"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid application", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.applicant_email !== user.email) {
      return NextResponse.json(
        { error: "Application email must match the signed-in account" },
        { status: 400 }
      );
    }

    const { db, storage } = await createAdminClient();
    const vacancy = await getRecruitmentJobById(db, jobId);

    if (
      !(vacancy && isRecruitmentVacancyOpen(vacancy.status, vacancy.metadata))
    ) {
      return NextResponse.json(
        { error: "Vacancy is not open" },
        { status: 400 }
      );
    }

    const missingAnswerError = assertRequiredAnswersPresent(
      vacancy.custom_questions,
      parsed.data.answers ?? []
    );
    if (missingAnswerError) {
      return NextResponse.json(
        { error: missingAnswerError },
        { status: 400 }
      );
    }

    const existingApplications = await db.listRows("app", "job_applications", [
      Query.equal("job_id", jobId),
      Query.equal("applicant_email", parsed.data.applicant_email),
      Query.limit(1),
    ]);

    if (existingApplications.total > 0) {
      return NextResponse.json(
        { error: "You have already applied for this vacancy" },
        { status: 409 }
      );
    }

    const resume = formData.get("resume");
    let resumeFileId: string | null = null;

    if (resume instanceof File && resume.size > 0) {
      validateRecruitmentResumeFile(resume);
      const buffer = Buffer.from(await resume.arrayBuffer());
      const uploadedFile = await storage.createFile(
        RECRUITMENT_RESUME_BUCKET_ID,
        ID.unique(),
        InputFile.fromBuffer(buffer, resume.name)
      );
      resumeFileId = uploadedFile.$id;
    } else if (vacancy.metadata.cv_required) {
      return NextResponse.json(
        { error: "A CV is required for this vacancy" },
        { status: 400 }
      );
    }

    const consentDate = new Date();
    const retentionUntil = computeRecruitmentRetentionUntil(vacancy.metadata);

    // Upsert the candidate profile keyed by email. This is the seed of the
    // talent-pool CRM and lets HR see all applications from one person.
    let candidateProfileId: string | null = null;
    try {
      const existingProfile = await db.listRows<CandidateProfiles>(
        "app",
        "candidate_profiles",
        [
          Query.equal("email", parsed.data.applicant_email),
          Query.limit(1),
        ]
      );
      if (existingProfile.rows[0]) {
        const current = existingProfile.rows[0];
        const updated = await db.updateRow<CandidateProfiles>(
          "app",
          "candidate_profiles",
          current.$id,
          {
            applications_count: (current.applications_count ?? 0) + 1,
            campus_id: vacancy.campus_id ?? current.campus_id,
            current_employer:
              parsed.data.current_employer ?? current.current_employer,
            current_role: parsed.data.current_role ?? current.current_role,
            data_retention_until: retentionUntil,
            full_name:
              parsed.data.applicant_name.length > 0
                ? parsed.data.applicant_name
                : current.full_name,
            last_application_at: consentDate.toISOString(),
            linkedin_url:
              parsed.data.linkedin_url ?? current.linkedin_url ?? null,
            phone: parsed.data.applicant_phone ?? current.phone ?? null,
          }
        );
        candidateProfileId = updated.$id;
      } else {
        const created = await db.createRow<CandidateProfiles>(
          "app",
          "candidate_profiles",
          ID.unique(),
          {
            applications_count: 1,
            campus_id: vacancy.campus_id,
            consent_date: consentDate.toISOString(),
            current_employer: parsed.data.current_employer ?? null,
            current_role: parsed.data.current_role ?? null,
            data_retention_until: retentionUntil,
            email: parsed.data.applicant_email,
            embedding_status: EmbeddingStatus.PENDING,
            full_name: parsed.data.applicant_name,
            gdpr_consent: true,
            last_application_at: consentDate.toISOString(),
            linkedin_url: parsed.data.linkedin_url ?? null,
            phone: parsed.data.applicant_phone ?? null,
            source: "public_apply",
            tags: null,
          }
        );
        candidateProfileId = created.$id;
      }
    } catch (profileError) {
      console.warn("Candidate profile upsert failed", profileError);
    }

    const application = await db.createRow(
      "app",
      "job_applications",
      ID.unique(),
      {
        applicant_email: parsed.data.applicant_email,
        applicant_name: parsed.data.applicant_name,
        applicant_phone: parsed.data.applicant_phone ?? null,
        candidate_profile_id: candidateProfileId,
        consent_date: consentDate.toISOString(),
        cover_letter: parsed.data.cover_letter ?? null,
        data_processing_purpose: "BISO recruitment process",
        data_retention_until: retentionUntil,
        embedding_status: EmbeddingStatus.PENDING,
        gdpr_consent: true,
        job_id: jobId,
        resume_file_id: resumeFileId,
        review_metadata: serializeRecruitmentApplicationReviewMetadata(
          buildRecruitmentApplicationReviewMetadata({
            candidate_availability: parsed.data.candidate_availability,
          })
        ),
        source: "public_apply",
        status: JobApplicationStatus.SUBMITTED,
      }
    );

    // Persist structured custom-question answers.
    for (const answer of parsed.data.answers ?? []) {
      try {
        await db.createRow<JobApplicationAnswers>(
          "app",
          "job_application_answers",
          ID.unique(),
          {
            answer: answer.answer ?? null,
            answer_type: answer.answer_type as JobApplicationAnswers["answer_type"],
            application_id: application.$id,
            job_id: jobId,
            question_id: answer.question_id,
            question_label: answer.question_label,
          }
        );
      } catch (answerError) {
        console.warn(
          `Failed to persist answer for ${answer.question_id}`,
          answerError
        );
      }
    }

    return NextResponse.json({
      data: {
        $id: application.$id,
      },
    });
  } catch (error) {
    console.error("Failed to submit recruitment application:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to submit application",
      },
      { status: 500 }
    );
  }
}
