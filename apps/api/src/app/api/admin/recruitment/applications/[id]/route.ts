import { createAdminClient } from "@repo/api/server";
import type { JobApplications } from "@repo/api/types/appwrite";
import {
  assertRecruitmentApplicationTransition,
  recruitmentApplicationStatusUpdateSchema,
} from "@repo/shared/types/recruitment";
import { type NextRequest, NextResponse } from "next/server";
import { createAuditLog, getAdminScope } from "@/lib/admin-auth";
import {
  assertRecruitmentApplicationReviewAccess,
  buildRecruitmentApplicationRecord,
  fetchRecruitmentJobsByIds,
  loadRecruitmentLookups,
} from "@/lib/recruitment";

type ApplicationWithAccessResult =
  | { error: NextResponse }
  | {
      application: JobApplications;
      db: Awaited<ReturnType<typeof createAdminClient>>["db"];
      job: Awaited<ReturnType<typeof fetchRecruitmentJobsByIds>> extends Map<
        string,
        infer TValue
      >
        ? TValue
        : never;
      jobsById: Awaited<ReturnType<typeof fetchRecruitmentJobsByIds>>;
      scope: NonNullable<Awaited<ReturnType<typeof getAdminScope>>>;
    };

async function getApplicationWithAccess(
  request: NextRequest,
  applicationId: string
): Promise<ApplicationWithAccessResult> {
  const scope = await getAdminScope(request);
  if (!scope) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!(scope.isGlobalAdmin || scope.isCampusAdmin)) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const { db } = await createAdminClient();
  const lookups = await loadRecruitmentLookups(db);
  const application = await db.getRow<JobApplications>(
    "app",
    "job_applications",
    applicationId
  );
  const jobsById = await fetchRecruitmentJobsByIds(db, [application.job_id]);
  const job = jobsById.get(application.job_id);

  if (!job) {
    return {
      error: NextResponse.json({ error: "Vacancy not found" }, { status: 404 }),
    };
  }

  try {
    assertRecruitmentApplicationReviewAccess(scope, lookups, job);
  } catch {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    application,
    db,
    job,
    jobsById,
    scope,
  };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const resolved = await getApplicationWithAccess(request, id);
    if ("error" in resolved) {
      return resolved.error;
    }

    return NextResponse.json({
      row: buildRecruitmentApplicationRecord(
        resolved.application,
        resolved.jobsById
      ),
    });
  } catch (error) {
    console.error("Failed to fetch recruitment application:", error);
    return NextResponse.json(
      { error: "Failed to fetch application" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const resolved = await getApplicationWithAccess(request, id);
    if ("error" in resolved) {
      return resolved.error;
    }

    const payload = recruitmentApplicationStatusUpdateSchema.safeParse(
      await request.json()
    );
    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid status payload", details: payload.error.flatten() },
        { status: 400 }
      );
    }

    assertRecruitmentApplicationTransition(
      resolved.application.status,
      payload.data.status
    );

    await resolved.db.updateRow("app", "job_applications", id, {
      status: payload.data.status,
    });

    await createAuditLog({
      action: "recruitment.application.status_update",
      actorId: resolved.scope.userId,
      payload: {
        from: resolved.application.status,
        to: payload.data.status,
      },
      resourceId: id,
      resourceType: "job_application",
    });

    return NextResponse.json({
      data: {
        $id: id,
        status: payload.data.status,
      },
    });
  } catch (error) {
    console.error("Failed to update recruitment application:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update application",
      },
      { status: 500 }
    );
  }
}
