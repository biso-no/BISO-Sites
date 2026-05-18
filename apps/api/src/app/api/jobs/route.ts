import { type NextRequest, NextResponse } from "next/server";

const WP_JOBS_URL = "https://biso.no/wp-json/wp/v2/awsm_job_openings";
const TIMEOUT_MS = 10_000;

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      campusId,
      per_page = 10,
      page = 1,
      includeExpired = false,
      departmentId,
      verv,
    } = body as {
      campusId?: string;
      per_page?: number;
      page?: number;
      includeExpired?: boolean;
      departmentId?: string;
      verv?: string;
    };

    const url = new URL(WP_JOBS_URL);
    if (campusId) {
      url.searchParams.set("campus_id", String(campusId));
    }
    url.searchParams.set("per_page", String(per_page));
    url.searchParams.set("page", String(page));
    url.searchParams.set("include_expired", includeExpired ? "true" : "false");
    if (departmentId) {
      url.searchParams.set("department_id", departmentId);
    }
    if (verv) {
      url.searchParams.set("verv", verv);
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "BisoApp/1.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `WordPress error: ${response.status}`,
          code: "UPSTREAM_ERROR",
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const jobs = Array.isArray(data) ? data : (data.jobs ?? []);
    const totalJobs =
      Number.parseInt(response.headers.get("x-wp-total") ?? "", 10) ||
      (data.total_jobs as number | undefined) ||
      jobs.length;

    return NextResponse.json({ jobs, total_jobs: totalJobs });
  } catch (err) {
    const error = err as { name?: string };
    if (error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Request timed out", code: "TIMEOUT" },
        { status: 502 }
      );
    }
    console.error("[jobs] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
