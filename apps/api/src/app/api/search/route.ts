import { parseSearchParams } from "@repo/shared/search/params";
import { runSearch } from "@repo/shared/search/query";
import {
  emptyPageResponse,
  emptyQuickResponse,
} from "@repo/shared/search/response";
import { type NextRequest, NextResponse } from "next/server";
import { applyCorsHeaders, corsPreflightResponse } from "@/lib/cors";
import { searchRunnerFromEnv } from "@/lib/search";

export const dynamic = "force-dynamic";

function json(body: unknown, origin: string | null, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return applyCorsHeaders(response, origin);
}

/**
 * Meilisearch error fields worth logging: name, API error code, HTTP status
 * and the network error code. Never the message or the query.
 *
 * Never pass the error object itself to Sentry `captureException` or log it
 * whole: a timeout error's `cause.requestInit.body` contains the query.
 */

function errorSummary(error: unknown): string {
  const e = (error ?? {}) as {
    name?: unknown;
    cause?: { code?: unknown; cause?: { code?: unknown } };
    response?: { status?: unknown };
  };
  const parts = [`name=${String(e.name ?? "")}`];
  const fields = [
    ["code", e.cause?.code],
    ["status", e.response?.status],
    ["cause_code", e.cause?.cause?.code],
  ] as const;
  for (const [label, value] of fields) {
    if (typeof value === "string" || typeof value === "number") {
      parts.push(`${label}=${value}`);
    }
  }
  return parts.join(" ");
}

/**
 * Public site search, backed by Meilisearch with a search-only key. The query
 * text is never logged.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const request = parseSearchParams(new URL(req.url).searchParams);

  if (!request.q) {
    return json(
      request.mode === "page"
        ? emptyPageResponse(request.q, request.locale, request.group)
        : emptyQuickResponse(request.q, request.locale),
      origin
    );
  }

  const search = searchRunnerFromEnv();
  if (!search) {
    return json(
      { error: "Search is not configured", code: "NOT_CONFIGURED" },
      origin,
      503
    );
  }

  try {
    const result = await runSearch(
      search.runner,
      search.indexName,
      request,
      new Date()
    );
    return json(result, origin);
  } catch (error) {
    console.error("[Search] failed:", errorSummary(error));
    return json(
      { error: "Search is unavailable", code: "UPSTREAM_ERROR" },
      origin,
      502
    );
  }
}

export function OPTIONS(req: NextRequest) {
  return corsPreflightResponse(req.headers.get("origin"));
}
