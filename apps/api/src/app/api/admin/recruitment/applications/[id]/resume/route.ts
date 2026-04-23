import { createAdminClient } from "@repo/api/server";
import type { JobApplications } from "@repo/api/types/appwrite";
import { RECRUITMENT_RESUME_BUCKET_ID } from "@repo/shared/types/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-auth";
import {
  assertRecruitmentApplicationReviewAccess,
  fetchRecruitmentJobsByIds,
  loadRecruitmentLookups,
} from "@/lib/recruitment";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(scope.isGlobalAdmin || scope.isCampusAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const { db, storage } = await createAdminClient();
    const lookups = await loadRecruitmentLookups(db);
    const application = await db.getRow<JobApplications>(
      "app",
      "job_applications",
      id
    );

    if (!application.resume_file_id) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const jobsById = await fetchRecruitmentJobsByIds(db, [application.job_id]);
    const job = jobsById.get(application.job_id);
    if (!job) {
      return NextResponse.json({ error: "Vacancy not found" }, { status: 404 });
    }

    assertRecruitmentApplicationReviewAccess(scope, lookups, job);

    const [file, buffer] = await Promise.all([
      storage.getFile(RECRUITMENT_RESUME_BUCKET_ID, application.resume_file_id),
      storage.getFileDownload(
        RECRUITMENT_RESUME_BUCKET_ID,
        application.resume_file_id
      ),
    ]);

    return new NextResponse(buffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Type": file.mimeType || "application/pdf",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Failed to download recruitment resume:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to download resume",
      },
      {
        status:
          error instanceof Error && error.message === "Forbidden" ? 403 : 500,
      }
    );
  }
}
