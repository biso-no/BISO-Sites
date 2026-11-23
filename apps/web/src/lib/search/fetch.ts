import type {
  PageSearchResponse,
  QuickSearchResponse,
  SearchGroup,
} from "@repo/shared/search/response";

export interface SearchQueryInput {
  campus?: string | null;
  group?: SearchGroup | null;
  locale: "no" | "en";
  mode: "quick" | "page";
  onlyCampus?: boolean;
  page?: number;
  q: string;
}

export class SearchUnavailableError extends Error {
  constructor(message = "Search is unavailable") {
    super(message);
    this.name = "SearchUnavailableError";
  }
}

const TRAILING_SLASHES = /\/+$/;
const DEFAULT_BASE = "http://localhost:3003";
const DEFAULT_TIMEOUT_MS = 8000;

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE;
}

export function searchUrl(input: SearchQueryInput, base = apiBase()): string {
  const params = new URLSearchParams();
  params.set("q", input.q);
  params.set("locale", input.locale);
  if (input.campus) {
    params.set("campus", input.campus);
  }
  if (input.onlyCampus) {
    params.set("only_campus", "1");
  }
  if (input.group) {
    params.set("type", input.group);
  }
  if (input.page && input.page > 1) {
    params.set("page", String(input.page));
  }
  params.set("mode", input.mode);
  return `${base.replace(TRAILING_SLASHES, "")}/api/search?${params.toString()}`;
}

export async function fetchSearch<M extends "quick" | "page">(
  input: SearchQueryInput & { mode: M },
  init: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<M extends "quick" ? QuickSearchResponse : PageSearchResponse> {
  const timeout = AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  let response: Response;
  try {
    response = await fetch(searchUrl(input), { credentials: "omit", signal });
  } catch (error) {
    // A caller-initiated abort is not an outage; let it through unchanged.
    if (init.signal?.aborted) {
      throw error;
    }
    throw new SearchUnavailableError();
  }
  if (!response.ok) {
    throw new SearchUnavailableError(`Search returned ${response.status}`);
  }
  try {
    return (await response.json()) as M extends "quick"
      ? QuickSearchResponse
      : PageSearchResponse;
  } catch {
    throw new SearchUnavailableError("Search returned invalid data");
  }
}
