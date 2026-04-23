import { Query } from "@repo/api";
import { createAdminClient } from "@repo/api/server";
import type { JobApplications } from "@repo/api/types/appwrite";
import { type NextRequest, NextResponse } from "next/server";
import { getAdminScope } from "@/lib/admin-auth";
import {
  buildRecruitmentApplicationRecord,
  canReviewRecruitmentVacancy,
  fetchRecruitmentListRows,
  loadRecruitmentLookups,
} from "@/lib/recruitment";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await getAdminScope(request);
    if (!scope) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(scope.isGlobalAdmin || scope.isCampusAdmin)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { db } = await createAdminClient();
    const lookups = await loadRecruitmentLookups(db);
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(
      Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
      1
    );
    const pageSize = 20;
    const status = searchParams.get("status");
    const jobIdFilter = searchParams.get("jobId");
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";

    const accessibleVacancies = (
      await fetchRecruitmentListRows(db, [
        Query.orderDesc("$updatedAt"),
        Query.limit(300),
      ])
    ).filter((vacancy) => canReviewRecruitmentVacancy(scope, lookups, vacancy));

    const accessibleJobIds = accessibleVacancies.map((vacancy) => vacancy.$id);
    if (accessibleJobIds.length === 0) {
      return NextResponse.json({ page, pageSize, rows: [], total: 0 });
    }

    if (jobIdFilter && !accessibleJobIds.includes(jobIdFilter)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const jobsById = new Map(
      accessibleVacancies.map((vacancy) => [vacancy.$id, vacancy])
    );
    const applicationQueries = [
      Query.orderDesc("$createdAt"),
      Query.equal("job_id", jobIdFilter ? [jobIdFilter] : accessibleJobIds),
      ...(status && status !== "all" ? [Query.equal("status", status)] : []),
      ...(search
        ? [Query.limit(300)]
        : [Query.limit(pageSize), Query.offset((page - 1) * pageSize)]),
    ];

    const applicationsResponse = await db.listRows<JobApplications>(
      "app",
      "job_applications",
      applicationQueries
    );

    let rows = applicationsResponse.rows.map((application) =>
      buildRecruitmentApplicationRecord(application, jobsById)
    );

    if (search) {
      rows = rows.filter((application) => {
        const title = application.job?.title.toLowerCase() ?? "";
        return (
          application.applicant_name.toLowerCase().includes(search) ||
          application.applicant_email.toLowerCase().includes(search) ||
          title.includes(search)
        );
      });
    }

    const pagedRows = search
      ? rows.slice((page - 1) * pageSize, page * pageSize)
      : rows;

    return NextResponse.json({
      page,
      pageSize,
      rows: pagedRows,
      total: search ? rows.length : applicationsResponse.total,
    });
  } catch (error) {
    console.error("Failed to list recruitment applications:", error);
    return NextResponse.json(
      { error: "Failed to list applications" },
      { status: 500 }
    );
  }
}
