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

interface TimedSignal {
  release: () => void;
  signal: AbortSignal;
}

/**
 * The caller's signal and a timeout as one signal. `AbortSignal.any` is
 * missing before Safari 17.4 (and `AbortSignal.timeout` before 16), so older
 * iPhones get a local controller that follows the caller's abort and a timer.
 * `release` clears the timer and the listener once the request is done.
 */
function timedSignal(
  caller: AbortSignal | undefined,
  timeoutMs: number
): TimedSignal {
  if (
    typeof AbortSignal.any === "function" &&
    typeof AbortSignal.timeout === "function"
  ) {
    const timeout = AbortSignal.timeout(timeoutMs);
    return {
      signal: caller ? AbortSignal.any([caller, timeout]) : timeout,
      release: () => undefined,
    };
  }
  const controller = new AbortController();
  const followCaller = () => controller.abort(caller?.reason);
  const timer = setTimeout(
    () =>
      controller.abort(new DOMException("Search timed out", "TimeoutError")),
    timeoutMs
  );
  if (caller?.aborted) {
    followCaller();
  } else {
    caller?.addEventListener("abort", followCaller, { once: true });
  }
  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer);
      caller?.removeEventListener("abort", followCaller);
    },
  };
}

export async function fetchSearch<M extends "quick" | "page">(
  input: SearchQueryInput & { mode: M },
  init: { signal?: AbortSignal; timeoutMs?: number } = {}
): Promise<M extends "quick" ? QuickSearchResponse : PageSearchResponse> {
  const { signal, release } = timedSignal(
    init.signal,
    init.timeoutMs ?? DEFAULT_TIMEOUT_MS
  );
  try {
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
    } catch (error) {
      // The body is read under the same signal, so the caller can abort here too.
      if (init.signal?.aborted) {
        throw error;
      }
      throw new SearchUnavailableError(
        signal.aborted ? "Search timed out" : "Search returned invalid data"
      );
    }
  } finally {
    release();
  }
}
