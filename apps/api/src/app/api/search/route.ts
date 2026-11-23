import {
  parseSearchParams,
  SEARCH_PAGE_SIZE,
} from "@repo/shared/search/params";
import { runSearch } from "@repo/shared/search/query";
import {
  emptyCounts,
  SEARCH_GROUPS,
  type SearchResponse,
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

function emptyResponse(
  req: ReturnType<typeof parseSearchParams>
): SearchResponse {
  if (req.mode === "page") {
    return {
      counts: emptyCounts(),
      group: req.group,
      hits: [],
      locale: req.locale,
      mode: "page",
      page: 1,
      pageSize: SEARCH_PAGE_SIZE,
      query: req.q,
      total: 0,
      totalPages: 0,
    };
  }
  const groups = Object.fromEntries(SEARCH_GROUPS.map((g) => [g, []]));
  return {
    best: null,
    counts: emptyCounts(),
    groups: groups as never,
    locale: req.locale,
    mode: "quick",
    query: req.q,
    total: 0,
  };
}

/** Error name and code only. The message can echo the query. */
function errorSummary(error: unknown): string {
  const { name, code } = (error ?? {}) as { name?: unknown; code?: unknown };
  return `name=${String(name ?? "")} code=${String(code ?? "")}`;
}

/**
 * Public site search, backed by Meilisearch with a search-only key. The query
 * text is never logged.
 */
export async function GET(req: NextRequest) {
  const origin = req.headers.get("origin");
  const request = parseSearchParams(new URL(req.url).searchParams);

  if (!request.q) {
    return json(emptyResponse(request), origin);
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
