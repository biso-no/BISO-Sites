export interface Source {
  /** The page the reader is on, when they asked from it. */
  current?: true;
  n: number;
  text: string;
  title: string;
  url: string;
}

export const PRIVATE_PLACEHOLDER =
  "[private detail, shown only to signed-in staff]";

const MAX_SOURCES = 6;
const MAX_CHARS = 120_000;
// Fumadocs' own default. The limit counts a page and each of its matching
// sections, so 60 entries come to about 7 pages, enough to fill 6 sources.
const SEARCH_LIMIT = 60;

// Paired tags first so their bodies go too, then any self-closing tag.
const PRIVATE_PAIRED = /<Private\b(?:[^>]*[^/>])?>[\s\S]*?<\/Private>/g;
const PRIVATE_SELF_CLOSING = /<Private\b[^>]*\/>/g;
const HASH_OR_QUERY = /[#?].*$/;
const TRAILING_SLASH = /(.)\/$/;

// Orama's English splitter: a word keeps letters, digits, _, ' and -.
const WORD_SPLIT = /[^a-z0-9àèéìòóù_'-]+/;
const POSSESSIVE = /'s$/;
const EDGE_MARKS = /^['-]+|['-]+$/g;
const WHITESPACE = /\s+/;

// The index matches a term to every word it starts, with no stop words of
// its own, so "how", "do", "i" and "a" would rank pages on their own.
const STOP_WORDS = new Set(
  `a about am an and any anyone anything are as at be been being by can could
  did do does done everyone everything for from had has have he her here his
  how i if in into is it its may me might must my of on or our shall she
  should so some someone something than that the their them then there these
  they this those to us was we were what when where which who whom whose why
  will with would you your`.split(WHITESPACE)
);

export function redactPrivate(text: string): string {
  return text
    .replace(PRIVATE_PAIRED, PRIVATE_PLACEHOLDER)
    .replace(PRIVATE_SELF_CLOSING, PRIVATE_PLACEHOLDER);
}

interface RankedPage {
  text: string;
  title: string;
  url: string;
}

export function selectSources(
  ranked: RankedPage[],
  opts: { currentUrl?: string; maxSources: number; maxChars: number }
): Source[] {
  const seen = new Set<string>();
  const unique: RankedPage[] = [];
  for (const page of ranked) {
    if (!seen.has(page.url)) {
      seen.add(page.url);
      unique.push(page);
    }
  }

  const current = unique.find((p) => p.url === opts.currentUrl);
  const ordered = current
    ? [current, ...unique.filter((p) => p !== current)]
    : unique;

  const picked: RankedPage[] = [];
  let used = 0;
  for (const page of ordered) {
    if (picked.length >= opts.maxSources) {
      break;
    }
    const isCurrent = page === current;
    // Pages go in whole. The page being read is kept even if it alone is over.
    if (!isCurrent && used + page.text.length > opts.maxChars) {
      continue;
    }
    picked.push(page);
    used += page.text.length;
  }

  return picked.map((page, i) =>
    page === current
      ? { ...page, n: i + 1, current: true }
      : { ...page, n: i + 1 }
  );
}

/** Lowercased words, split as the index splits them, with no possessive 's. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(WORD_SPLIT)
    .map((word) => word.replace(POSSESSIVE, "").replace(EDGE_MARKS, ""))
    .filter((word) => word.length > 1);
}

/**
 * The words of a question worth searching for: no question words, stop words
 * or punctuation, each once. The prompt still gets the question as asked.
 */
export function searchTerms(question: string): string[] {
  return [...new Set(words(question).filter((word) => !STOP_WORDS.has(word)))];
}

/** How many terms start a word in `text`, the way the index matches them. */
function termsIn(text: string, terms: string[]): number {
  const found = new Set(words(text));
  return terms.filter((term) => {
    for (const word of found) {
      if (word.startsWith(term)) {
        return true;
      }
    }
    return false;
  }).length;
}

/**
 * Orders pages found for `terms`, best first. A page scores one for each term
 * in its text and one more for each term in its title; ties keep the order
 * the pages came in. The index ranks a page by its single best section, so a
 * short line elsewhere that holds one common term can outrank the page that
 * answers the question.
 */
export function rankPages<T extends RankedPage>(
  pages: T[],
  terms: string[]
): T[] {
  return pages
    .map((page, order) => ({
      page,
      order,
      score: termsIn(page.text, terms) + termsIn(page.title, terms),
    }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ page }) => page);
}

function normalizeUrl(url: string): string {
  return url.replace(HASH_OR_QUERY, "").replace(TRAILING_SLASH, "$1");
}

export async function retrieveSources(
  question: string,
  currentUrl?: string
): Promise<Source[]> {
  // Loaded here so the pure helpers above stay importable without the
  // generated fumadocs source.
  const [{ searchApi }, { source, getLLMText }] = await Promise.all([
    import("./search"),
    import("lib/source"),
  ]);

  const pages = source.getPages();
  const pagesByUrl = new Map(
    pages.map((page) => [normalizeUrl(page.url), page])
  );

  const terms = searchTerms(question);
  const hits = await searchApi.search(
    terms.length > 0 ? terms.join(" ") : question,
    { limit: SEARCH_LIMIT }
  );
  const urls: string[] = [];
  for (const hit of hits) {
    const url = normalizeUrl(hit.url);
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  // The index holds each title as an entry of its own, but a page whose title
  // names a term can still fall below the cut. Those pages join the rest.
  for (const page of pages) {
    const url = normalizeUrl(page.url);
    if (!urls.includes(url) && termsIn(page.data.title, terms) > 0) {
      urls.push(url);
    }
  }
  const current = currentUrl ? normalizeUrl(currentUrl) : undefined;
  if (current && !urls.includes(current)) {
    urls.push(current);
  }

  const found: RankedPage[] = [];
  for (const url of urls) {
    const page = pagesByUrl.get(url);
    if (!page) {
      continue;
    }
    found.push({
      url: normalizeUrl(page.url),
      title: page.data.title,
      text: redactPrivate(await getLLMText(page)),
    });
  }
  const ranked = rankPages(found, terms);

  return selectSources(ranked, {
    currentUrl: current,
    maxSources: MAX_SOURCES,
    maxChars: MAX_CHARS,
  });
}
