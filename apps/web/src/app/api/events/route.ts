// apps/web/src/app/api/events/route.ts
import { createAdminClient } from "@repo/api/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type RequestBody = {
  campusId?: string;
  per_page?: number;
  page?: number;
  include_past?: boolean;
  search?: string;
};

type ValidatedRequestBody = {
  campusId?: string;
  per_page: number;
  page: number;
  include_past: boolean;
  search?: string;
};

type WordPressEvent = {
  id: number;
  title: string;
  slug: string;
  description: string;
  excerpt: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  cost: string;
  website: string;
  thumbnail: unknown;
  organizer: unknown;
  venue: unknown;
  categories: string[];
  tags: string[];
  language: string;
  translations: Record<string, number>;
};

type WordPressApiResponse = {
  events: WordPressEvent[];
  pagination: {
    current_page: number;
    per_page: number;
    total_events: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
  search_term?: string | null;
};

type CampusRow = {
  $id: string;
  name?: string | null;
  [key: string]: unknown;
};

type DbClient = {
  getRow: (
    databaseId: string,
    tableId: string,
    rowId: string
  ) => Promise<unknown>;
};

const CONFIG = {
  TIMEOUT_MS: Number.parseInt(process.env.FETCH_TIMEOUT_MS ?? "8000", 10),
  MAX_PER_PAGE: 100,
  MIN_PER_PAGE: 1,
  DEFAULT_PER_PAGE: 25,
  MAX_RETRIES: 2,
  MIN_SEARCH_LENGTH: 2,
  MAX_SEARCH_LENGTH: 100,
  WORDPRESS_BASE_URL:
    process.env.WORDPRESS_BASE_URL ?? "https://biso.no/wp-json/biso/v1/events",
} as const;

class AppwriteEventsError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppwriteEventsError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function validateEnvironment(requireDatabase: boolean): {
  databaseId?: string;
  collectionId?: string;
} {
  if (!requireDatabase) {
    return {};
  }

  const databaseId = process.env.DATABASE_ID;
  const collectionId = process.env.COLLECTION_ID;
  const missing: string[] = [];

  if (!databaseId) {
    missing.push("DATABASE_ID");
  }
  if (!collectionId) {
    missing.push("COLLECTION_ID");
  }

  if (missing.length > 0) {
    throw new AppwriteEventsError(
      `Missing required environment variables: ${missing.join(", ")}`,
      500,
      "MISSING_ENV_VARS"
    );
  }

  return { databaseId, collectionId };
}

function validatePerPage(per_page?: number): number {
  if (per_page === undefined) {
    return CONFIG.DEFAULT_PER_PAGE;
  }
  if (
    !Number.isInteger(per_page) ||
    per_page < CONFIG.MIN_PER_PAGE ||
    per_page > CONFIG.MAX_PER_PAGE
  ) {
    throw new AppwriteEventsError(
      `per_page must be an integer between ${CONFIG.MIN_PER_PAGE} and ${CONFIG.MAX_PER_PAGE}`,
      400,
      "INVALID_PER_PAGE"
    );
  }
  return per_page;
}

function validatePage(page?: number): number {
  if (page === undefined) {
    return 1;
  }
  if (!Number.isInteger(page) || page < 1) {
    throw new AppwriteEventsError(
      "page must be a positive integer",
      400,
      "INVALID_PAGE"
    );
  }
  return page;
}

function validateSearch(search?: string): string | undefined {
  if (search === undefined) {
    return;
  }

  if (typeof search !== "string") {
    throw new AppwriteEventsError(
      "search must be a string",
      400,
      "INVALID_SEARCH_TYPE"
    );
  }

  const trimmedSearch = search.trim();
  if (trimmedSearch.length === 0) {
    return;
  }

  if (trimmedSearch.length < CONFIG.MIN_SEARCH_LENGTH) {
    throw new AppwriteEventsError(
      `search term must be at least ${CONFIG.MIN_SEARCH_LENGTH} characters long`,
      400,
      "SEARCH_TOO_SHORT"
    );
  }
  if (trimmedSearch.length > CONFIG.MAX_SEARCH_LENGTH) {
    throw new AppwriteEventsError(
      `search term must be no more than ${CONFIG.MAX_SEARCH_LENGTH} characters long`,
      400,
      "SEARCH_TOO_LONG"
    );
  }
  return trimmedSearch;
}

function normalizeCampusId(campusId?: unknown): string | undefined {
  return typeof campusId === "string" && campusId.trim().length > 0
    ? campusId.trim()
    : undefined;
}

function validateRequestBody(body: unknown): ValidatedRequestBody {
  if (!body || typeof body !== "object") {
    throw new AppwriteEventsError(
      "Request body is required and must be a valid JSON object",
      400,
      "INVALID_BODY"
    );
  }

  const { campusId, per_page, page, include_past, search } =
    body as RequestBody;

  return {
    campusId: normalizeCampusId(campusId),
    per_page: validatePerPage(per_page),
    page: validatePage(page),
    include_past: include_past === true,
    search: validateSearch(search),
  };
}

async function fetchCampusWithRetry(
  db: DbClient,
  databaseId: string,
  tableId: string,
  campusId: string,
  log: (message: string, ...args: unknown[]) => void,
  retries = CONFIG.MAX_RETRIES
): Promise<CampusRow> {
  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const campus = (await db.getRow(
        databaseId,
        tableId,
        campusId
      )) as CampusRow;

      if (!campus.name || typeof campus.name !== "string") {
        throw new AppwriteEventsError(
          "Campus found but has invalid or missing name",
          400,
          "INVALID_CAMPUS_DATA"
        );
      }

      return campus;
    } catch (err) {
      const error = err as { code?: number; message?: string };

      if (attempt > retries) {
        if (error.code === 404) {
          throw new AppwriteEventsError(
            `Campus with ID "${campusId}" not found`,
            404,
            "CAMPUS_NOT_FOUND"
          );
        }
        throw new AppwriteEventsError(
          "Failed to fetch campus data after retries",
          500,
          "CAMPUS_FETCH_FAILED"
        );
      }

      log(`Campus fetch attempt ${attempt} failed, retrying...`, error.message);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, 1000 * attempt);
      });
    }
  }

  throw new AppwriteEventsError(
    "Unexpected error in campus fetch",
    500,
    "UNEXPECTED_ERROR"
  );
}

async function fetchEventsWithRetry(
  params: ValidatedRequestBody,
  log: (message: string, ...args: unknown[]) => void,
  campus?: CampusRow,
  retries = CONFIG.MAX_RETRIES
): Promise<WordPressApiResponse> {
  const organizerSlug = campus
    ? `biso-${String(campus.name)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")}`
    : undefined;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const url = new URL(CONFIG.WORDPRESS_BASE_URL);

      if (organizerSlug) {
        url.searchParams.append("organizer", organizerSlug);
      }
      url.searchParams.append("per_page", params.per_page.toString());
      url.searchParams.append("page", params.page.toString());
      url.searchParams.append(
        "include_past",
        params.include_past ? "true" : "false"
      );

      if (params.search) {
        url.searchParams.append("search", params.search);
      }

      log(`Attempt ${attempt}: Fetching events from: ${url.toString()}`);

      timeoutId = setTimeout(() => {
        controller.abort();
      }, CONFIG.TIMEOUT_MS);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "BisoApp/1.0",
        },
      });

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        throw new Error("Response is not JSON");
      }

      const data = (await response.json()) as unknown;

      if (Array.isArray(data)) {
        // Old format - array of events
        log(`Received ${data.length} events (old format)`);
        return {
          events: data as WordPressEvent[],
          pagination: {
            current_page: params.page,
            per_page: params.per_page,
            total_events: data.length,
            total_pages: 1,
            has_next: false,
            has_previous: false,
          },
          search_term: params.search ?? null,
        };
      }

      if (
        data &&
        typeof data === "object" &&
        Array.isArray((data as { events?: unknown[] }).events)
      ) {
        const typed = data as {
          events: WordPressEvent[];
          pagination: WordPressApiResponse["pagination"];
          search_term?: string | null;
        };

        log(
          `Received ${typed.events.length} events, ${
            typed.pagination?.total_events ?? 0
          } total`
        );

        return {
          events: typed.events,
          pagination: typed.pagination,
          search_term: typed.search_term ?? params.search ?? null,
        };
      }

      throw new Error("Invalid response format from WordPress API");
    } catch (err) {
      const error = err as { name?: string; message?: string };

      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      if (attempt > retries) {
        if (error.name === "AbortError") {
          throw new AppwriteEventsError(
            `Request timeout after ${CONFIG.TIMEOUT_MS}ms`,
            408,
            "REQUEST_TIMEOUT"
          );
        }
        throw new AppwriteEventsError(
          `Failed to fetch events: ${error.message}`,
          502,
          "EVENTS_FETCH_FAILED"
        );
      }

      log(`Events fetch attempt ${attempt} failed:`, error.message);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, 1000 * attempt);
      });
    }
  }

  throw new AppwriteEventsError(
    "Unexpected error in events fetch",
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

function sanitizeHeaders(headers: Headers): Record<string, unknown> {
  const masked: Record<string, unknown> = {};

  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    if (
      lower === "authorization" ||
      lower === "cookie" ||
      lower === "x-appwrite-key"
    ) {
      masked[key] = "<masked>";
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

export async function POST(req: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const logWithId = (message: string, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.log(`[${requestId}] ${message}`, ...args);
  };

  const errorLog = (message: string, ...args: unknown[]) => {
    // eslint-disable-next-line no-console
    console.error(message, ...args);
  };

  try {
    logWithId("Function execution started");

    try {
      const headersObject = sanitizeHeaders(req.headers);
      logWithId("Headers:", JSON.stringify(headersObject));
    } catch {
      // ignore logging failures
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw new AppwriteEventsError(
        "Request body is required and must be valid JSON",
        400,
        "INVALID_BODY"
      );
    }

    const validatedParams = validateRequestBody(body);
    logWithId("Request validated:", JSON.stringify(validatedParams));

    const hasCampusId =
      typeof validatedParams.campusId === "string" &&
      validatedParams.campusId.length > 0;

    const { databaseId, collectionId } = validateEnvironment(hasCampusId);

    let campus: CampusRow | undefined;

    if (hasCampusId) {
      logWithId("CampusId provided, will fetch campus and query by organizer");

      const { db } = await createAdminClient();

      if (!(databaseId && collectionId)) {
        throw new AppwriteEventsError(
          "Database configuration missing after validation",
          500,
          "INTERNAL_CONFIG_ERROR"
        );
      }

      campus = await fetchCampusWithRetry(
        db as DbClient,
        databaseId,
        collectionId,
        validatedParams.campusId as string,
        logWithId
      );
      logWithId(`Campus found: ${campus.name}`);
    } else {
      logWithId(
        "No campusId provided, will fetch global events (no organizer filter)"
      );
    }

    const eventsData = await fetchEventsWithRetry(
      validatedParams,
      logWithId,
      campus
    );

    const executionTime = Date.now() - startTime;
    logWithId(`Function completed successfully in ${executionTime}ms`);

    const response: {
      success: boolean;
      events: WordPressEvent[];
      pagination: WordPressApiResponse["pagination"];
      total_events: number;
      campus?:
        | {
            id: string;
            name: string | null | undefined;
          }
        | undefined;
      metadata: {
        requestId: string;
        executionTime: number;
        timestamp: string;
      };
      search_term?: string | null;
    } = {
      success: true,
      events: eventsData.events,
      pagination: eventsData.pagination,
      total_events: eventsData.pagination.total_events,
      campus: campus
        ? {
            id: campus.$id,
            name: campus.name ?? null,
          }
        : undefined,
      metadata: {
        requestId,
        executionTime,
        timestamp: new Date().toISOString(),
      },
    };

    if (eventsData.search_term !== undefined) {
      response.search_term = eventsData.search_term;
    }

    return NextResponse.json(response);
  } catch (err) {
    const executionTime = Date.now() - startTime;
    const error = err as
      | AppwriteEventsError
      | (Error & { statusCode?: number; code?: string });

    if (error instanceof AppwriteEventsError) {
      logWithId(`Business error [${error.code}]:`, error.message);

      if (error.statusCode >= 400 && error.statusCode < 500) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              statusCode: error.statusCode,
            },
            metadata: {
              requestId,
              executionTime,
              timestamp: new Date().toISOString(),
            },
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            statusCode: error.statusCode,
          },
          metadata: {
            requestId,
            executionTime,
            timestamp: new Date().toISOString(),
          },
        },
        { status: error.statusCode || 500 }
      );
    }

    errorLog(`[${requestId}] Unexpected error:`, error);

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
