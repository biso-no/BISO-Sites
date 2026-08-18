import type { FetchLike } from "../types";

const DEFAULT_PER_PAGE = "100";
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const TRAILING_SLASH_REGEX = /\/$/;

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
    if (path.startsWith("/wc/v3") && this.consumerKey && this.consumerSecret) {
      url.searchParams.set("consumer_key", this.consumerKey);
      url.searchParams.set("consumer_secret", this.consumerSecret);
    }
    return url.toString();
  }

  private async request(url: string): Promise<Response> {
    let lastError = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const response = await this.fetchImpl(url, {
        headers: { "User-Agent": "biso-wp-import/1.0" },
      });
      if (response.ok) {
        return response;
      }
      if (!RETRYABLE_STATUSES.has(response.status)) {
        throw new Error(
          `WordPress request failed with ${response.status} for ${url}`
        );
      }
      lastError = `${response.status}`;
      await sleep(2 ** attempt * 500);
    }
    throw new Error(
      `WordPress request failed after ${MAX_RETRIES} retries (${lastError}) for ${url}`
    );
  }

  async fetchJson<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const response = await this.request(this.buildUrl(path, params));
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
      const response = await this.request(url);
      const header = response.headers.get("X-WP-TotalPages");
      totalPages = header ? Number.parseInt(header, 10) || 1 : 1;
      const body = (await response.json()) as T[];
      rows.push(...(Array.isArray(body) ? body : []));
      page += 1;
    } while (page <= totalPages);

    return rows;
  }
}
