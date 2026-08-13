import { NextResponse } from "next/server";

const WP_EVENTS_URL = "https://biso.no/wp-json/biso/v1/events";
const WP_JOBS_URL = "https://biso.no/wp-json/wp/v2/awsm_job_openings";
const TIMEOUT_MS = 10_000;

interface WordPressEventsParams {
  campusId?: string;
  include_past: boolean;
  page: number;
  per_page: number;
  search?: string;
}

interface WordPressJobsParams {
  campusId?: string;
  departmentId?: string;
  includeExpired: boolean;
  page: number;
  per_page: number;
  verv?: string;
}

function upstreamErrorResponse(status: number) {
  return NextResponse.json(
    { error: `WordPress error: ${status}`, code: "UPSTREAM_ERROR" },
    { status: 502 }
  );
}

function proxyErrorResponse(err: unknown, scope: string) {
  const error = err as { name?: string };
  if (error.name === "TimeoutError") {
    return NextResponse.json(
      { error: "Request timed out", code: "TIMEOUT" },
      { status: 502 }
    );
  }
  console.error(`[${scope}] Unexpected error:`, err);
  return NextResponse.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

export async function fetchWordPressEvents(
  params: WordPressEventsParams
): Promise<NextResponse> {
  try {
    const url = new URL(WP_EVENTS_URL);
    if (params.campusId) {
      url.searchParams.set("campus_id", String(params.campusId));
    }
    url.searchParams.set("per_page", String(params.per_page));
    url.searchParams.set("page", String(params.page));
    url.searchParams.set(
      "include_past",
      params.include_past ? "true" : "false"
    );
    if (params.search) {
      url.searchParams.set("search", params.search);
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "BisoApp/1.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      return upstreamErrorResponse(response.status);
    }

    const data = await response.json();
    const events = Array.isArray(data) ? data : (data.events ?? []);
    const totalEvents =
      Number.parseInt(response.headers.get("x-wp-total") ?? "", 10) ||
      (data.total_events as number | undefined) ||
      events.length;

    return NextResponse.json({
      events,
      total_events: totalEvents,
      source: "wordpress",
    });
  } catch (err) {
    return proxyErrorResponse(err, "events");
  }
}

export async function fetchWordPressJobs(
  params: WordPressJobsParams
): Promise<NextResponse> {
  try {
    const url = new URL(WP_JOBS_URL);
    if (params.campusId) {
      url.searchParams.set("campus_id", String(params.campusId));
    }
    url.searchParams.set("per_page", String(params.per_page));
    url.searchParams.set("page", String(params.page));
    url.searchParams.set(
      "include_expired",
      params.includeExpired ? "true" : "false"
    );
    if (params.departmentId) {
      url.searchParams.set("department_id", params.departmentId);
    }
    if (params.verv) {
      url.searchParams.set("verv", params.verv);
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "BisoApp/1.0" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      return upstreamErrorResponse(response.status);
    }

    const data = await response.json();
    const jobs = Array.isArray(data) ? data : (data.jobs ?? []);
    const totalJobs =
      Number.parseInt(response.headers.get("x-wp-total") ?? "", 10) ||
      (data.total_jobs as number | undefined) ||
      jobs.length;

    return NextResponse.json({
      jobs,
      total_jobs: totalJobs,
      source: "wordpress",
    });
  } catch (err) {
    return proxyErrorResponse(err, "jobs");
  }
}
