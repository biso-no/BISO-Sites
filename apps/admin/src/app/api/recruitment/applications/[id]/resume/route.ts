import { Query } from "@repo/api";
import { createAdminClient, createSessionClient } from "@repo/api/server";
import type { JobApplications, Jobs } from "@repo/api/types/appwrite";
import {
  applicationDocumentFileId,
  isApplicationDocument,
} from "@repo/shared/recruitment/application-documents";
import { RECRUITMENT_RESUME_BUCKET_ID } from "@repo/shared/types/recruitment";
import { NextResponse } from "next/server";
import { getUserAuthContext } from "@/lib/authorization";
import {
  assertRecruitmentApplicationReviewAccess,
  loadRecruitmentLookups,
  toRecruitmentAdminScope,
} from "@/lib/recruitment";

/**
 * Serves one of an application's PDFs. `?doc=resume|cover_letter` picks
 * the file (default resume). The drawer previews it in an iframe, so the
 * default disposition is inline; `?download=1` forces a download.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getUserAuthContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scope = toRecruitmentAdminScope(ctx);
    if (!(scope.isGlobalAdmin || scope.isCampusAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const { db } = await createSessionClient();
    const { storage } = await createAdminClient();
    const lookups = await loadRecruitmentLookups(db);
    const application = await db.getRow<JobApplications>(
      "app",
      "job_applications",
      id,
      [Query.select(["*", "job.$id", "job.campus_id", "job.department_id"])]
    );

    const url = new URL(request.url);
    const docParam = url.searchParams.get("doc") ?? "resume";
    const document = isApplicationDocument(docParam) ? docParam : "resume";
    const fileId = applicationDocumentFileId(application, document);
    if (!fileId) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }
    const disposition = url.searchParams.get("download")
      ? "attachment"
      : "inline";

    const job = application.job as Jobs | null;
    if (!job) {
      return NextResponse.json({ error: "Vacancy not found" }, { status: 404 });
    }

    assertRecruitmentApplicationReviewAccess(scope, lookups, job);

    const [file, buffer] = await Promise.all([
      storage.getFile(RECRUITMENT_RESUME_BUCKET_ID, fileId),
      storage.getFileDownload(RECRUITMENT_RESUME_BUCKET_ID, fileId),
    ]);

    return new NextResponse(buffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `${disposition}; filename="${file.name}"`,
        "Content-Type": file.mimeType || "application/pdf",
      },
      status: 200,
    });
  } catch (error) {
    // Don't leak raw Appwrite error messages (bucket/table ids, not-found
    // semantics) to the client — log server-side, return a generic message.
    const isForbidden = error instanceof Error && error.message === "Forbidden";
    if (!isForbidden) {
      console.error("Failed to download resume:", error);
    }
    return NextResponse.json(
      { error: isForbidden ? "Forbidden" : "Failed to download resume" },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
