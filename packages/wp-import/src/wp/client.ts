import type { FetchLike } from "../types";

const DEFAULT_PER_PAGE = "100";
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const TRAILING_SLASH_REGEX = /\/$/;
const SENSITIVE_QUERY_PARAMS = ["consumer_key", "consumer_secret"];

export interface WpClientOptions {
  baseUrl: string;
  /** WooCommerce consumer key — only required for /wc/v3 routes. */
  consumerKey?: string;
  consumerSecret?: string;
  fetchImpl?: FetchLike;
}

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
  private readonly consumerKey?: string;
  private readonly consumerSecret?: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: WpClientOptions) {
    this.baseUrl = options.baseUrl.replace(TRAILING_SLASH_REGEX, "");
    this.consumerKey = options.consumerKey;
    this.consumerSecret = options.consumerSecret;
    this.fetchImpl = options.fetchImpl ?? fetch;
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
      const response = await this.fetchImpl(url, {
        headers: {
          "User-Agent": "biso-wp-import/1.0",
          ...this.authHeaders(path),
        },
      });
      if (response.ok) {
        return response;
      }
      if (!RETRYABLE_STATUSES.has(response.status)) {
        throw new Error(
          `WordPress request failed with ${response.status} for ${redactUrl(url)}`
        );
      }
      lastError = `${response.status}`;
      await sleep(2 ** attempt * 500);
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

  async fetchAllPages<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T[]> {
    const rows: T[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const url = this.buildUrl(path, {
        per_page: DEFAULT_PER_PAGE,
        ...params,
        page: String(page),
      });
      const response = await this.request(url, path);
      const header = response.headers.get("X-WP-TotalPages");
      totalPages = header ? Number.parseInt(header, 10) || 1 : 1;
      const body = (await response.json()) as T[];
      rows.push(...(Array.isArray(body) ? body : []));
      page += 1;
    } while (page <= totalPages);

    return rows;
  }
}
