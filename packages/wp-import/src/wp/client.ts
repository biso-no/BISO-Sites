import { mapWithConcurrency } from "../concurrency";
import type { FetchLike } from "../types";

const DEFAULT_PER_PAGE = "100";
const MAX_RETRIES = 3;
/**
 * Pages after the first are fetched in parallel. Deliberately modest: biso.no
 * is production WordPress, and deep WooCommerce pages are expensive queries
 * (`?page=141` is `OFFSET 14000`), so a wide fan-out buys 429s rather than
 * speed. Raise it with `--concurrency=N` if the host tolerates more.
 */
const DEFAULT_CONCURRENCY = 4;
/**
 * Per-request ceiling. `fetch` has no default timeout, so without this a
 * WooCommerce request that stalls leaves the whole extract hanging with no
 * output and no way to tell a slow endpoint from a dead one. A timeout is
 * retryable — a stalled connection usually succeeds on the next attempt.
 */
const DEFAULT_TIMEOUT_MS = 120_000;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const TRAILING_SLASH_REGEX = /\/$/;
const SENSITIVE_QUERY_PARAMS = ["consumer_key", "consumer_secret"];

/**
 * Emitted as each page lands and on every retry. The client itself never
 * writes to the console — the CLI scripts decide how to render this, which
 * keeps the test suite's output pristine.
 */
export type WpProgressEvent =
  | {
      kind: "page";
      path: string;
      page: number;
      totalPages: number;
      received: number;
      total: number | null;
      elapsedMs: number;
    }
  | {
      kind: "retry";
      path: string;
      attempt: number;
      maxRetries: number;
      reason: string;
      backoffMs: number;
    };

export interface WpClientOptions {
  baseUrl: string;
  /** Pages fetched in parallel after page 1. Defaults to DEFAULT_CONCURRENCY. */
  concurrency?: number;
  /** WooCommerce consumer key — only required for /wc/v3 routes. */
  consumerKey?: string;
  consumerSecret?: string;
  fetchImpl?: FetchLike;
  onProgress?: (event: WpProgressEvent) => void;
  /** Per-request timeout in ms. Defaults to DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * A response the server answered definitively (404, 401, …). It must abort the
 * retry loop rather than being mistaken for a transport failure, so it is a
 * distinct class instead of a string-matched message.
 */
class NonRetryableHttpError extends Error {}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Strips consumer_key/consumer_secret from a URL before it can land in a
 * thrown error message. Defense-in-depth: credentials no longer travel as
 * query params (see authHeaders below), but a redacted URL is still safe to
 * log even if some future caller passes them as params directly.
 */
function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, "REDACTED");
      }
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

export class WpClient {
  private readonly baseUrl: string;
  private readonly concurrency: number;
  private readonly consumerKey?: string;
  private readonly consumerSecret?: string;
  private readonly fetchImpl: FetchLike;
  private readonly onProgress?: (event: WpProgressEvent) => void;
  private readonly timeoutMs: number;

  constructor(options: WpClientOptions) {
    this.baseUrl = options.baseUrl.replace(TRAILING_SLASH_REGEX, "");
    this.concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    this.consumerKey = options.consumerKey;
    this.consumerSecret = options.consumerSecret;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.onProgress = options.onProgress;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private buildUrl(path: string, params: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}/wp-json${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  /**
   * WooCommerce REST auth as a `Basic` header rather than
   * ?consumer_key=&consumer_secret= query parameters. A 401 while setting
   * these up is the *expected* first failure, and query-string credentials
   * would land in both the thrown error message below and biso.no's HTTP
   * access logs — a header does neither.
   */
  private authHeaders(path: string): Record<string, string> {
    if (
      !(path.startsWith("/wc/v3") && this.consumerKey && this.consumerSecret)
    ) {
      return {};
    }
    const token = Buffer.from(
      `${this.consumerKey}:${this.consumerSecret}`
    ).toString("base64");
    return { Authorization: `Basic ${token}` };
  }

  private async request(url: string, path: string): Promise<Response> {
    let lastError = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      let retryReason: string;
      try {
        const response = await this.fetchImpl(url, {
          headers: {
            "User-Agent": "biso-wp-import/1.0",
            ...this.authHeaders(path),
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (response.ok) {
          return response;
        }
        if (!RETRYABLE_STATUSES.has(response.status)) {
          throw new NonRetryableHttpError(
            `WordPress request failed with ${response.status} for ${redactUrl(url)}`
          );
        }
        retryReason = `HTTP ${response.status}`;
      } catch (error) {
        // A definitive HTTP status must keep propagating; only transport
        // failures (timeout, socket reset) are worth another attempt.
        if (error instanceof NonRetryableHttpError) {
          throw error;
        }
        retryReason =
          error instanceof Error && error.name === "TimeoutError"
            ? `timeout after ${this.timeoutMs}ms`
            : `network error (${String(error)})`;
      }

      lastError = retryReason;
      const backoffMs = 2 ** attempt * 500;
      this.onProgress?.({
        attempt: attempt + 1,
        backoffMs,
        kind: "retry",
        maxRetries: MAX_RETRIES,
        path,
        reason: retryReason,
      });
      await sleep(backoffMs);
    }
    throw new Error(
      `WordPress request failed after ${MAX_RETRIES} retries (${lastError}) for ${redactUrl(url)}`
    );
  }

  async fetchJson<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const response = await this.request(this.buildUrl(path, params), path);
    return (await response.json()) as T;
  }

  private async fetchPage<T>(
    path: string,
    params: Record<string, string>,
    page: number
  ): Promise<{
    elapsedMs: number;
    rows: T[];
    total: number | null;
    totalPages: number;
  }> {
    const url = this.buildUrl(path, {
      per_page: DEFAULT_PER_PAGE,
      ...params,
      page: String(page),
    });
    const startedAt = Date.now();
    const response = await this.request(url, path);
    const pagesHeader = response.headers.get("X-WP-TotalPages");
    const totalHeader = response.headers.get("X-WP-Total");
    const body = (await response.json()) as T[];
    return {
      elapsedMs: Date.now() - startedAt,
      rows: Array.isArray(body) ? body : [],
      total: totalHeader ? Number.parseInt(totalHeader, 10) || null : null,
      totalPages: pagesHeader ? Number.parseInt(pagesHeader, 10) || 1 : 1,
    };
  }

  /**
   * Page 1 is fetched alone — `X-WP-TotalPages` is the only way to learn how
   * many pages exist, so nothing can be fanned out until it lands. Pages
   * 2..N then run through a bounded pool and are concatenated back in page
   * order, so the result is identical to the old serial walk.
   */
  async fetchAllPages<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T[]> {
    const first = await this.fetchPage<T>(path, params, 1);
    // Counts completed records, not the pages requested so far — pages land
    // out of order now, so this is the only figure that stays monotonic.
    let received = first.rows.length;
    this.onProgress?.({
      elapsedMs: first.elapsedMs,
      kind: "page",
      page: 1,
      path,
      received,
      total: first.total,
      totalPages: first.totalPages,
    });

    if (first.totalPages <= 1) {
      return first.rows;
    }

    const remainingPages = Array.from(
      { length: first.totalPages - 1 },
      (_, index) => index + 2
    );
    const pages = await mapWithConcurrency(
      remainingPages,
      this.concurrency,
      async (page) => {
        const result = await this.fetchPage<T>(path, params, page);
        received += result.rows.length;
        this.onProgress?.({
          elapsedMs: result.elapsedMs,
          kind: "page",
          page,
          path,
          received,
          total: result.total,
          totalPages: first.totalPages,
        });
        return result.rows;
      }
    );

    return [...first.rows, ...pages.flat()];
  }
}
