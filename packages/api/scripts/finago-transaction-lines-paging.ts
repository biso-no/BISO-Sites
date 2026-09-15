/**
 * Pure pagination and search-window helpers for the Finago `/transactionlines`
 * REST endpoint, used by the stranded-posting reset script. Kept free of `fetch` so the
 * paging logic can be unit-tested without a network call.
 *
 * The endpoint follows RFC 5988 `Link` header pagination (see
 * `packages/connectors/src/24sevenoffice/rest/schema.d.ts` around the
 * `/transactionlines` `get` operation): a `link` response header carries
 * `first`/`previous`/`next` relations, and the caller must follow `next`
 * until it is absent to see every line in the requested window.
 */

const LINK_URL_REGEX = /<([^>]+)>/;
const LINK_REL_REGEX = /rel="([^"]+)"/;

/**
 * Extracts the `next` relation's URL from a `Link` header value, or `null`
 * when there is no further page.
 */
export function parseNextLinkUrl(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }

  for (const part of linkHeader.split(",")) {
    const urlMatch = part.match(LINK_URL_REGEX);
    const relMatch = part.match(LINK_REL_REGEX);
    if (urlMatch && relMatch?.[1] === "next") {
      return urlMatch[1];
    }
  }

  return null;
}

export interface TransactionLinesPage {
  /** The lines on this page; empty when `ok` is `false`. */
  lines: unknown[];
  /** The next page's URL, or `null` when this was the last page. */
  nextUrl: string | null;
  /** `false` when this page's request failed and paging must stop. */
  ok: boolean;
}

export interface TransactionLinesResult {
  /** Every line collected across all pages; empty when `ok` is `false`. */
  lines: unknown[];
  /** `false` when a page failed or pagination did not terminate. */
  ok: boolean;
  /** True when paging stopped at `MAX_PAGES`: the date range is too large. */
  pageCapReached?: boolean;
  /** Set when `ok` is `false`, for the caller's refusal message. */
  reason?: string;
}

// The search window runs from the order's creation to today, so an order
// stranded for a long time can span many lines. This cap fails closed rather
// than loop forever (e.g. a `Link` header pointing back at an earlier page) or
// page through an unbounded range; the caller then refuses and says to check
// Finago by hand.
const MAX_PAGES = 50;

/**
 * Follows Finago's `Link`-header pagination from `firstUrl`, collecting every
 * page's lines via the injected `fetchPage` callback. Fails closed: if any
 * page reports `ok: false`, or pagination runs past `MAX_PAGES` without
 * terminating, the whole result is `ok: false` and no partial lines are
 * returned — callers must refuse to reset on a non-ok result rather than act
 * on an incomplete set of lines.
 */
export async function collectAllTransactionLines(
  firstUrl: string,
  fetchPage: (url: string) => Promise<TransactionLinesPage>
): Promise<TransactionLinesResult> {
  const lines: unknown[] = [];
  let url: string | null = firstUrl;
  let pageCount = 0;

  while (url) {
    pageCount += 1;
    if (pageCount > MAX_PAGES) {
      return {
        lines: [],
        ok: false,
        pageCapReached: true,
        reason: `Exceeded ${MAX_PAGES} pages while paging Finago transaction lines; refusing rather than risk missing a match.`,
      };
    }

    const page = await fetchPage(url);
    if (!page.ok) {
      return {
        lines: [],
        ok: false,
        reason: `Failed to fetch Finago transaction lines page ${pageCount}.`,
      };
    }

    lines.push(...page.lines);
    url = page.nextUrl;
  }

  return { lines, ok: true };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 1;

export interface TransactionLinesWindow {
  /** Inclusive voucher date, `YYYY-MM-DD`. */
  dateFrom: string;
  /** Exclusive voucher date, `YYYY-MM-DD`. */
  dateTo: string;
}

/** `YYYY-MM-DD` for `date` as a calendar day in Oslo. */
function osloDate(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Oslo",
    year: "numeric",
  }).format(date);
}

/**
 * The voucher-date range to search for an order's Finago lines.
 *
 * A voucher is dated when it is POSTED (`ledgerDate()`), which can be long
 * after the order was created — e.g. an order that waited weeks for a
 * configuration fix. So the range runs from a day before creation through
 * today in Oslo (`dateTo` is exclusive, hence today + 1). It deliberately does
 * not narrow by the order's `$updatedAt`: later refund writes move that past
 * the posting time.
 */
export function transactionLinesSearchWindow(
  createdAt: string,
  now: Date = new Date()
): TransactionLinesWindow {
  const created = Date.parse(createdAt);
  if (Number.isNaN(created)) {
    throw new Error(`Invalid order creation time: ${createdAt}`);
  }
  const dateFrom = new Date(created - LOOKBACK_DAYS * DAY_MS)
    .toISOString()
    .slice(0, 10);
  const todayInOslo = Date.parse(`${osloDate(now)}T00:00:00.000Z`);
  const dateTo = new Date(todayInOslo + DAY_MS).toISOString().slice(0, 10);
  return { dateFrom, dateTo };
}

/** Why the script refuses after a non-ok paging result. */
export function pagingRefusalMessage(
  result: TransactionLinesResult,
  window: TransactionLinesWindow
): string {
  if (result.pageCapReached) {
    return `Refusing: the Finago date range ${window.dateFrom}..${window.dateTo} is too large to search completely (${result.reason ?? "page cap reached"}). Check Finago manually for a voucher mentioning this order before clearing the marker by hand.`;
  }
  return `Refusing: could not read Finago transaction lines (${result.reason ?? "unknown error"}).`;
}
