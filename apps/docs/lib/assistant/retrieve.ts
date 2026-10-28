export interface Source {
  n: number;
  text: string;
  title: string;
  url: string;
}

export const PRIVATE_PLACEHOLDER =
  "[private detail, shown only to signed-in staff]";

const MAX_SOURCES = 6;
const MAX_CHARS = 120_000;
const SEARCH_LIMIT = 20;

// Paired tags first so their bodies go too, then any self-closing tag.
const PRIVATE_PAIRED = /<Private\b(?:[^>]*[^/>])?>[\s\S]*?<\/Private>/g;
const PRIVATE_SELF_CLOSING = /<Private\b[^>]*\/>/g;
const HASH_OR_QUERY = /[#?].*$/;
const TRAILING_SLASH = /(.)\/$/;

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

  return picked.map((page, i) => ({ ...page, n: i + 1 }));
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

  const pagesByUrl = new Map(
    source.getPages().map((page) => [normalizeUrl(page.url), page])
  );

  const hits = await searchApi.search(question, { limit: SEARCH_LIMIT });
  const urls: string[] = [];
  for (const hit of hits) {
    const url = normalizeUrl(hit.url);
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }
  const current = currentUrl ? normalizeUrl(currentUrl) : undefined;
  if (current && !urls.includes(current)) {
    urls.push(current);
  }

  const ranked: RankedPage[] = [];
  for (const url of urls) {
    const page = pagesByUrl.get(url);
    if (!page) {
      continue;
    }
    ranked.push({
      url: normalizeUrl(page.url),
      title: page.data.title,
      text: redactPrivate(await getLLMText(page)),
    });
  }

  return selectSources(ranked, {
    currentUrl: current,
    maxSources: MAX_SOURCES,
    maxChars: MAX_CHARS,
  });
}
