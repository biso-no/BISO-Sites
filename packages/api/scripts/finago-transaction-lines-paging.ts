/**
 * Pure pagination helpers for the Finago `/transactionlines` REST endpoint,
 * shared by the stranded-posting reset script. Kept free of `fetch` so the
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
  /** Set when `ok` is `false`, for the caller's refusal message. */
  reason?: string;
}

// A 6-day transaction-line window should never come close to this many
// pages; it exists only to fail closed instead of looping forever if Finago
// ever returns a `Link` header that points back at an earlier page.
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
