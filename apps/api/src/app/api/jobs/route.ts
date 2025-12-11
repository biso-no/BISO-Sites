// app/api/jobs/route.ts
import { createAdminClient } from "@repo/api/server";
import type { Campus } from "@repo/api/types/appwrite";
import { type NextRequest, NextResponse } from "next/server";
import type { Models } from "node-appwrite";

type RequestBody = {
  campusId: string;
  per_page?: number;
  page?: number;
  departmentId?: string;
  verv?: string;
  includeExpired?: boolean;
};

type WordPressJob = {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  campus: string[];
  department: string[];
  verv: string[];
  url: string;
  date_posted: string;
  date_modified: string;
  expiry_date: string | null;
  is_expired: boolean;
  location: string | null;
  job_type: string | null;
  salary_range: string | null;
  application_deadline: string | null;
  is_featured: boolean;
  thumbnail: unknown;
};

type WordPressJobsApiResponse = {
  jobs: WordPressJob[];
  pagination: {
    current_page: number;
    per_page: number;
    total_jobs: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
};

interface CampusDocument extends Models.Document {
  name: string;
  [key: string]: unknown;
}

const CONFIG = {
  TIMEOUT_MS: Number.parseInt(process.env.FETCH_TIMEOUT_MS || "8000", 10),
  MAX_PER_PAGE: 100,
  MIN_PER_PAGE: 1,
  DEFAULT_PER_PAGE: 5,
  MAX_RETRIES: 2,
  WORDPRESS_BASE_URL:
    process.env.WORDPRESS_JOBS_BASE_URL ||
    "https://biso.no/wp-json/custom/v1/jobs/",
} as const;

class AppwriteJobsError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppwriteJobsError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function validateRequestBody(body: unknown): RequestBody {
  if (!body || typeof body !== "object") {
    throw new AppwriteJobsError(
      "Request body is required and must be a valid JSON object",
      400,
      "INVALID_BODY"
    );
  }

  const { campusId, per_page, page, departmentId, verv, includeExpired } =
    body as Record<string, unknown>;

  if (
    !campusId ||
    typeof campusId !== "string" ||
    campusId.trim().length === 0
  ) {
    throw new AppwriteJobsError(
      "campusId is required and must be a non-empty string",
      400,
      "INVALID_CAMPUS_ID"
    );
  }

  let validatedPerPage: number = CONFIG.DEFAULT_PER_PAGE;
  if (per_page !== undefined) {
    if (
      !Number.isInteger(per_page) ||
      (per_page as number) < CONFIG.MIN_PER_PAGE ||
      (per_page as number) > CONFIG.MAX_PER_PAGE
    ) {
      throw new AppwriteJobsError(
        `per_page must be an integer between ${CONFIG.MIN_PER_PAGE} and ${CONFIG.MAX_PER_PAGE}`,
        400,
        "INVALID_PER_PAGE"
      );
    }
    validatedPerPage = per_page as number;
  }

  let validatedPage = 1;
  if (page !== undefined) {
    if (!Number.isInteger(page) || (page as number) < 1) {
      throw new AppwriteJobsError(
        "page must be a positive integer",
        400,
        "INVALID_PAGE"
      );
    }
    validatedPage = page as number;
  }

  return {
    campusId: campusId.trim(),
    per_page: validatedPerPage,
    page: validatedPage,
    departmentId:
      typeof departmentId === "string" ? departmentId.trim() : undefined,
    verv: typeof verv === "string" ? verv.trim() : undefined,
    includeExpired: includeExpired === true,
  };
}

function cleanHtmlContent(htmlContent: string): string {
  if (!htmlContent) {
    return "";
  }

  let cleaned = htmlContent.replace(/<!-- wp:[^>]*-->/g, "");
  cleaned = cleaned.replace(/<!-- \/wp:[^>]*-->/g, "");

  cleaned = cleaned.replace(/&amp;/g, "&");
  cleaned = cleaned.replace(/&lt;/g, "<");
  cleaned = cleaned.replace(/&gt;/g, ">");
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#039;/g, "'");
  cleaned = cleaned.replace(/&nbsp;/g, " ");

  cleaned = cleaned.replace(/<p[^>]*>/g, "<p>");
  cleaned = cleaned.replace(/<h([1-6])[^>]*>/g, "<h$1>");
  cleaned = cleaned.replace(/<ul[^>]*>/g, "<ul>");
  cleaned = cleaned.replace(/<ol[^>]*>/g, "<ol>");
  cleaned = cleaned.replace(/<li[^>]*>/g, "<li>");

  cleaned = cleaned.replace(/<strong[^>]*>/g, "<strong>");
  cleaned = cleaned.replace(/<b[^>]*>/g, "<strong>");
  cleaned = cleaned.replace(/<em[^>]*>/g, "<em>");
  cleaned = cleaned.replace(/<i[^>]*>/g, "<em>");

  cleaned = cleaned.replace(/<a[^>]*href="([^"]+)"[^>]*>/g, '<a href="$1">');

  cleaned = cleaned.replace(/<br[^>]*>/g, "<br>");

  cleaned = cleaned.replace(/>\s+</g, "><");

  cleaned = cleaned.replace(/<p><\/p>/g, "");
  cleaned = cleaned.replace(/<p>\s*<\/p>/g, "");

  cleaned = cleaned.replace(/<\/?div[^>]*>/g, "");
  cleaned = cleaned.replace(/<\/?span[^>]*>/g, "");

  return cleaned.trim();
}

function transformJobData(job: WordPressJob) {
  return {
    id: job.id,
    title: job.title,
    description: cleanHtmlContent(job.content),
    excerpt: job.excerpt,
    slug: job.slug,
    campus: job.campus,
    department: job.department,
    verv: job.verv,
    url: job.url,
    date_posted: job.date_posted,
    date_modified: job.date_modified,
    expiry_date: job.expiry_date,
    is_expired: job.is_expired,
    location: job.location,
    job_type: job.job_type,
    salary_range: job.salary_range,
    application_deadline: job.application_deadline,
    is_featured: job.is_featured,
    thumbnail: job.thumbnail,
  };
}

async function fetchCampusWithRetry(
  campusId: string,
  log: (msg: string, ...args: unknown[]) => void,
  retries: number = CONFIG.MAX_RETRIES
): Promise<Campus> {
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const { db } = await createAdminClient();
    try {
      const campus = await db.getRow<Campus>("app", "campus", campusId);

      if (!campus.name || typeof campus.name !== "string") {
        throw new AppwriteJobsError(
          "Campus found but has invalid or missing name",
          400,
          "INVALID_CAMPUS_DATA"
        );
      }

      return campus;
    } catch (err: any) {
      if (attempt > retries) {
        if (err.code === 404) {
          throw new AppwriteJobsError(
            `Campus with ID "${campusId}" not found`,
            404,
            "CAMPUS_NOT_FOUND"
          );
        }

        throw new AppwriteJobsError(
          "Failed to fetch campus data after retries",
          500,
          "CAMPUS_FETCH_FAILED"
        );
      }

      log(`Campus fetch attempt ${attempt} failed, retrying...`, err.message);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new AppwriteJobsError(
    "Unexpected error in campus fetch",
    500,
    "UNEXPECTED_ERROR"
  );
}

function buildJobsUrl(campus: Campus, params: RequestBody): URL {
  const url = new URL(CONFIG.WORDPRESS_BASE_URL);
  url.searchParams.append("campus", campus.name);
  url.searchParams.append("per_page", params.per_page?.toString() || "10");
  url.searchParams.append("page", params.page?.toString() || "1");
  url.searchParams.append(
    "includeExpired",
    params.includeExpired ? "true" : "false"
  );

  if (params.departmentId) {
    url.searchParams.append("departmentId", params.departmentId);
  }

  if (params.verv) {
    url.searchParams.append("verv", params.verv);
  }
  return url;
}

async function parseJobsResponse(
  response: Response,
  log: (msg: string, ...args: unknown[]) => void,
  params: RequestBody
): Promise<WordPressJobsApiResponse> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new Error("Response is not JSON");
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    log(`Received ${data.length} jobs (old format)`);
    return {
      jobs: data,
      pagination: {
        current_page: params.page || 1,
        per_page: params.per_page || 10,
        total_jobs: data.length,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      },
    };
  }

  if (data && typeof data === "object" && Array.isArray((data as any).jobs)) {
    const typed = data as WordPressJobsApiResponse;
    log(
      `Received ${typed.jobs.length} jobs, ${
        typed.pagination?.total_jobs || 0
      } total`
    );
    return typed;
  }

  throw new Error("Invalid response format from WordPress API");
}

async function fetchJobsWithRetry(
  campus: Campus,
  params: RequestBody,
  log: (msg: string, ...args: unknown[]) => void,
  retries: number = CONFIG.MAX_RETRIES
): Promise<WordPressJobsApiResponse> {
  const url = buildJobsUrl(campus, params);

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, CONFIG.TIMEOUT_MS);

    try {
      log(`Attempt ${attempt}: Fetching jobs from: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "BisoApp/1.0",
        },
      });

      clearTimeout(timeoutId);
      return await parseJobsResponse(response, log, params);
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (attempt > retries) {
        if (err.name === "AbortError") {
          throw new AppwriteJobsError(
            `Request timeout after ${CONFIG.TIMEOUT_MS}ms`,
            408,
            "REQUEST_TIMEOUT"
          );
        }

        throw new AppwriteJobsError(
          `Failed to fetch jobs: ${err.message}`,
          502,
          "JOBS_FETCH_FAILED"
        );
      }

      log(`Jobs fetch attempt ${attempt} failed:`, err.message);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new AppwriteJobsError(
    "Unexpected error in jobs fetch",
    500,
    "UNEXPECTED_ERROR"
  );
}

function generateRequestId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const logWithId = (message: string, ...args: unknown[]) => {
    console.log(`[${requestId}] ${message}`, ...args);
  };

  const errorLog = (message: string, ...args: unknown[]) => {
    console.error(message, ...args);
  };

  try {
    logWithId("Jobs function execution started");

    const body = (await req.json()) as RequestBody;
    const validatedParams = validateRequestBody(body);

    logWithId("Request validated:", JSON.stringify(validatedParams));

    const campus = await fetchCampusWithRetry(
      validatedParams.campusId,
      logWithId
    );
    logWithId(`Campus found: ${campus.name}`);

    const jobsData = await fetchJobsWithRetry(
      campus,
      validatedParams,
      logWithId
    );

    const transformedJobs = jobsData.jobs.map(transformJobData);

    const executionTime = Date.now() - startTime;
    logWithId(`Function completed successfully in ${executionTime}ms`);

    return NextResponse.json({
      success: true,
      jobs: transformedJobs,
      pagination: jobsData.pagination,
      total_jobs: jobsData.pagination.total_jobs,
      campus: {
        id: campus.$id,
        name: campus.name,
      },
      metadata: {
        requestId,
        executionTime,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    const executionTime = Date.now() - startTime;

    if (err instanceof AppwriteJobsError) {
      logWithId(`Business error [${err.code}]:`, err.message);

      const status = err.statusCode >= 500 ? err.statusCode : 200;

      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            statusCode: err.statusCode,
          },
          metadata: {
            requestId,
            executionTime,
            timestamp: new Date().toISOString(),
          },
        },
        { status }
      );
    }

    errorLog(`[${requestId}] Unexpected error:`, err);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
          statusCode: 500,
        },
        metadata: {
          requestId,
          executionTime,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
