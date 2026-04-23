import { ID, InputFile, Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import { JobApplicationStatus } from "@repo/api/types/appwrite";
import {
  computeRecruitmentRetentionUntil,
  isRecruitmentVacancyOpen,
  RECRUITMENT_RESUME_BUCKET_ID,
  recruitmentApplicationSubmitSchema,
  validateRecruitmentResumeFile,
} from "@repo/shared/types/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth";
import {
  getRecruitmentJobById,
  isAuthenticatedAppwriteUser,
} from "@/lib/recruitment";

function toBoolean(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") {
    return false;
  }

  return value === "true" || value === "on";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
): Promise<NextResponse> {
  try {
    const { jobId } = await context.params;
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
      cover_letter: formData.get("cover_letter"),
      gdpr_consent: toBoolean(formData.get("gdpr_consent")),
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

    const application = await db.createRow(
      "app",
      "job_applications",
      ID.unique(),
      {
        applicant_email: parsed.data.applicant_email,
        applicant_name: parsed.data.applicant_name,
        applicant_phone: parsed.data.applicant_phone ?? null,
        consent_date: new Date().toISOString(),
        cover_letter: parsed.data.cover_letter ?? null,
        data_processing_purpose: "BISO recruitment process",
        data_retention_until: computeRecruitmentRetentionUntil(
          vacancy.metadata
        ),
        gdpr_consent: true,
        job_id: jobId,
        resume_file_id: resumeFileId,
        status: JobApplicationStatus.SUBMITTED,
      }
    );

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
