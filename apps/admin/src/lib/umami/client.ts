/**
 * Umami Read API — typed, defensively-parsed data layer.
 *
 * This is a PLAIN module (NOT "use server"): it exports constants, types, and
 * async fetchers. It must never be marked "use server" because that would turn
 * every value export into a server action and break the build.
 *
 * The token-cache shape mirrors `packages/connectors/src/24sevenoffice/rest/`:
 * `getCredentials()` reads env and throws a clear "missing env" error, and a
 * module-scoped cached bearer token is refreshed on expiry or a 401.
 *
 * The live Umami instance is not reachable from CI/build, so every fetcher is
 * wrapped in try/catch, validates the response shape, and returns a typed
 * empty/null fallback. Nothing here ever throws out of a page render.
 */

import "server-only";

/** Website id for web.biso.no in the self-hosted Umami instance. */
export const WEB_WEBSITE_ID = "ada2c233-ee4f-4064-87c0-feaeb52c56ce";

/** Default reporting timezone for time-bucketed queries. */
export const UMAMI_TIMEZONE = "Europe/Oslo";

// Refresh the bearer token this long before the soft TTL elapses.
const EXPIRY_BUFFER_MS = 60 * 1000;
// Umami login tokens are long-lived; refresh ours every 6h regardless.
const TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
// Cap on rows pulled from list-style endpoints.
const DEFAULT_METRIC_LIMIT = 10;
const SESSIONS_PAGE_SIZE = 200;
const TRAILING_SLASH_RE = /\/+$/;
// Cache Umami reads for 5 min. The page quantizes the range to a 5-min bucket so
// the URL stays stable, letting repeated loads — and the per-session detail
// lookups used for the Members panel — hit the cache instead of refetching.
const REVALIDATE_SECONDS = 300;

export interface UmamiRange {
  /** Epoch milliseconds, inclusive start. */
  endAt: number;
  /** Epoch milliseconds, inclusive end. */
  startAt: number;
}

interface UmamiCredentials {
  apiUrl: string;
  password: string;
  username: string;
}

interface CachedToken {
  expiresAt: number;
  token: string;
}

let cachedToken: CachedToken | null = null;

function getCredentials(): UmamiCredentials {
  const apiUrl = process.env.UMAMI_API_URL;
  const username = process.env.UMAMI_USERNAME;
  const password = process.env.UMAMI_PASSWORD;

  if (!(apiUrl && username && password)) {
    throw new Error(
      "[Umami] Missing credentials. Required env vars: UMAMI_API_URL, UMAMI_USERNAME, UMAMI_PASSWORD"
    );
  }

  return { apiUrl: apiUrl.replace(TRAILING_SLASH_RE, ""), username, password };
}

async function login(): Promise<string> {
  const { apiUrl, username, password } = getCredentials();

  const response = await fetch(`${apiUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `[Umami] Login failed: ${response.status} ${response.statusText} — ${text}`
    );
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) {
    throw new Error("[Umami] Login response did not contain a token");
  }

  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + TOKEN_TTL_MS - EXPIRY_BUFFER_MS,
  };
  return data.token;
}

async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }
  return await login();
}

/**
 * Authenticated GET against the Umami Read API. Returns the parsed JSON on
 * success, or `null` on any failure (network error, non-2xx, bad shape). Retries
 * once after refreshing the token when the first attempt is a 401.
 */
async function umamiGet<T>(path: string): Promise<T | null> {
  try {
    const { apiUrl } = getCredentials();
    const url = `${apiUrl}${path}`;

    let token = await getToken();
    let response = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (response.status === 401) {
      token = await getToken(true);
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        next: { revalidate: REVALIDATE_SECONDS },
      });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `[Umami] GET ${path} failed: ${response.status} ${response.statusText}${
          body ? ` — ${body}` : ""
        }`
      );
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`[Umami] GET ${path} threw:`, error);
    return null;
  }
}

function buildRangeQuery(range: UmamiRange): string {
  return `startAt=${range.startAt}&endAt=${range.endAt}`;
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// ---------------------------------------------------------------------------
// Stats — totals + previous-period values for deltas.
// GET /api/websites/{id}/stats?startAt&endAt
// → { pageviews:{value,prev}, visitors:{...}, visits:{...}, bounces:{...}, totaltime:{...} }
// ---------------------------------------------------------------------------

export interface UmamiStatValue {
  prev: number;
  value: number;
}

export interface UmamiStats {
  bounces: UmamiStatValue;
  pageviews: UmamiStatValue;
  totaltime: UmamiStatValue;
  visitors: UmamiStatValue;
  visits: UmamiStatValue;
}

export const EMPTY_STATS: UmamiStats = {
  bounces: { value: 0, prev: 0 },
  pageviews: { value: 0, prev: 0 },
  totaltime: { value: 0, prev: 0 },
  visitors: { value: 0, prev: 0 },
  visits: { value: 0, prev: 0 },
};

// Read one stat across both Umami shapes:
//  - current: each field is a plain number, prev under a sibling `comparison`
//    object (`{ pageviews: 15171, comparison: { pageviews: 38675 } }`)
//  - legacy:  each field is a `{ value, prev }` object
function readStat(data: Record<string, unknown>, key: string): UmamiStatValue {
  const raw = data[key];
  if (typeof raw === "number") {
    const comparison = data.comparison;
    const prev =
      comparison && typeof comparison === "object"
        ? (comparison as Record<string, unknown>)[key]
        : undefined;
    return { value: toNumber(raw), prev: toNumber(prev) };
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return { value: toNumber(obj.value), prev: toNumber(obj.prev) };
  }
  return { value: 0, prev: 0 };
}

export async function fetchStats(
  range: UmamiRange
): Promise<UmamiStats | null> {
  const data = await umamiGet<Record<string, unknown>>(
    `/api/websites/${WEB_WEBSITE_ID}/stats?${buildRangeQuery(range)}`
  );
  if (!data) {
    return null;
  }
  return {
    bounces: readStat(data, "bounces"),
    pageviews: readStat(data, "pageviews"),
    totaltime: readStat(data, "totaltime"),
    visitors: readStat(data, "visitors"),
    visits: readStat(data, "visits"),
  };
}

// ---------------------------------------------------------------------------
// Pageviews timeseries.
// GET /api/websites/{id}/pageviews?startAt&endAt&unit=day&timezone=Europe/Oslo
// → { pageviews:[{x,y}], sessions:[{x,y}] }
// ---------------------------------------------------------------------------

export interface UmamiSeriesPoint {
  /** Bucket label (ISO date string from Umami). */
  x: string;
  /** Count for the bucket. */
  y: number;
}

export interface UmamiPageviewsSeries {
  pageviews: UmamiSeriesPoint[];
  sessions: UmamiSeriesPoint[];
}

function parseSeries(raw: unknown): UmamiSeriesPoint[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const points: UmamiSeriesPoint[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && "x" in item) {
      const obj = item as Record<string, unknown>;
      points.push({ x: String(obj.x), y: toNumber(obj.y) });
    }
  }
  return points;
}

export async function fetchPageviewsSeries(
  range: UmamiRange
): Promise<UmamiPageviewsSeries> {
  const data = await umamiGet<Record<string, unknown>>(
    `/api/websites/${WEB_WEBSITE_ID}/pageviews?${buildRangeQuery(range)}&unit=day&timezone=${UMAMI_TIMEZONE}`
  );
  if (!data) {
    return { pageviews: [], sessions: [] };
  }
  return {
    pageviews: parseSeries(data.pageviews),
    sessions: parseSeries(data.sessions),
  };
}

// ---------------------------------------------------------------------------
// Metrics — top pages / referrers / events.
// GET /api/websites/{id}/metrics?startAt&endAt&type=path|referrer|event&limit
// → [{x,y}]
// NOTE: current Umami uses `type=path` for top pages (the older `url` value is
// rejected with 400). Valid types: path, entry, exit, title, query, referrer,
// channel, domain, country, region, city, browser, os, device, language,
// screen, event, hostname, tag.
// ---------------------------------------------------------------------------

export type UmamiMetricType = "path" | "referrer" | "event";

export interface UmamiMetricItem {
  /** The path / referrer / event name. */
  x: string;
  /** Occurrence count. */
  y: number;
}

export async function fetchTopMetrics(
  range: UmamiRange,
  type: UmamiMetricType,
  limit: number = DEFAULT_METRIC_LIMIT
): Promise<UmamiMetricItem[]> {
  const data = await umamiGet<unknown>(
    `/api/websites/${WEB_WEBSITE_ID}/metrics?${buildRangeQuery(range)}&type=${type}&limit=${limit}`
  );
  if (!Array.isArray(data)) {
    return [];
  }
  const items: UmamiMetricItem[] = [];
  for (const item of data) {
    if (item && typeof item === "object" && "x" in item) {
      const obj = item as Record<string, unknown>;
      const label = obj.x == null ? "" : String(obj.x);
      items.push({ x: label, y: toNumber(obj.y) });
    }
  }
  return items;
}

// ---------------------------------------------------------------------------
// Events total — headline "events tracked" count. The current Umami `/events`
// endpoint returns a paginated envelope `{ data, count, page, pageSize }`, where
// `count` is the total event rows in range — that's the number we want. Older /
// timeseries variants returned an array of `{ y }` buckets, which we still sum
// as a fallback so the KPI keeps working across versions.
// GET /api/websites/{id}/events?startAt&endAt
// ---------------------------------------------------------------------------

export async function fetchEventsTotal(range: UmamiRange): Promise<number> {
  const data = await umamiGet<unknown>(
    `/api/websites/${WEB_WEBSITE_ID}/events?${buildRangeQuery(range)}&pageSize=1`
  );
  // Paginated envelope: use the authoritative `count`.
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const count = (data as Record<string, unknown>).count;
    return count == null ? 0 : toNumber(count);
  }
  // Legacy timeseries array of `{ y }` buckets.
  if (!Array.isArray(data)) {
    return 0;
  }
  let total = 0;
  for (const item of data) {
    if (item && typeof item === "object" && "y" in item) {
      total += toNumber((item as Record<string, unknown>).y);
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Sessions — raw rows used to build the Members panel.
// GET /api/websites/{id}/sessions?startAt&endAt
//
// The web app calls `umami.identify(<Appwrite account $id>, …)`, so identified
// sessions carry a `distinctId` equal to the Appwrite account $id. IMPORTANT:
// the sessions LIST does not include `distinctId` — only the session DETAIL
// endpoint (`/sessions/{id}`) does. So the list gives us `id`/`visits`/`views`,
// and `fetchSessionDistinctId` resolves the distinctId per session. (We still
// read `distinctId` off the list in case a future version exposes it, letting
// callers skip the detail call.)
// ---------------------------------------------------------------------------

export interface UmamiSessionRow {
  /** Appwrite account $id supplied via umami.identify(), when present. */
  distinctId?: string | null;
  id?: string;
  views?: number;
  visits?: number;
}

function extractSessionRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === "object") {
    const envelope = (data as Record<string, unknown>).data;
    if (Array.isArray(envelope)) {
      return envelope;
    }
  }
  return [];
}

export async function fetchSessions(
  range: UmamiRange
): Promise<UmamiSessionRow[]> {
  const data = await umamiGet<unknown>(
    `/api/websites/${WEB_WEBSITE_ID}/sessions?${buildRangeQuery(range)}&pageSize=${SESSIONS_PAGE_SIZE}`
  );

  const rows = extractSessionRows(data);

  const sessions: UmamiSessionRow[] = [];
  for (const item of rows) {
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const distinctId =
        typeof obj.distinctId === "string" ? obj.distinctId : null;
      sessions.push({
        distinctId,
        id: typeof obj.id === "string" ? obj.id : undefined,
        views: toNumber(obj.views),
        visits: toNumber(obj.visits),
      });
    }
  }
  return sessions;
}

/**
 * Resolve a single session's `distinctId` (the Appwrite account $id set via
 * `umami.identify`). Only the session DETAIL endpoint exposes it. Returns null
 * for anonymous sessions, missing data, or any failure.
 * GET /api/websites/{id}/sessions/{sessionId}
 */
export async function fetchSessionDistinctId(
  sessionId: string
): Promise<string | null> {
  const data = await umamiGet<Record<string, unknown>>(
    `/api/websites/${WEB_WEBSITE_ID}/sessions/${sessionId}`
  );
  const distinctId = data?.distinctId;
  return typeof distinctId === "string" && distinctId.trim().length > 0
    ? distinctId.trim()
    : null;
}

// ---------------------------------------------------------------------------
// Derived presentation helpers (pure, sync).
// ---------------------------------------------------------------------------

/** Bounce rate as a 0–100 percentage of visits. */
export function bounceRatePct(stats: UmamiStats): number {
  if (stats.visits.value <= 0) {
    return 0;
  }
  return Math.round((stats.bounces.value / stats.visits.value) * 100);
}

/** Average visit time in seconds (totaltime is reported in seconds). */
export function avgVisitSeconds(stats: UmamiStats): number {
  if (stats.visits.value <= 0) {
    return 0;
  }
  return Math.round(stats.totaltime.value / stats.visits.value);
}

/** Format a seconds duration as `m:ss` (or `0:00`). */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Percent change of `value` vs `prev`, formatted with a sign. Returns null when
 * a meaningful delta cannot be computed (no previous data).
 */
export function formatDelta(value: number, prev: number): string | null {
  if (prev <= 0) {
    return null;
  }
  const pct = Math.round(((value - prev) / prev) * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}
