import type { ContentTranslations, News } from "@repo/api/types/appwrite";

const SCHEME_RELATIVE_RE = /^\/[a-z][a-z0-9+.-]*:/i;

export function filterArticles(
  articles: News[],
  category: string,
  searchQuery: string
) {
  const query = searchQuery.trim().toLowerCase();

  return articles.filter((article) => {
    const translation = Array.isArray(article.translation_refs)
      ? article.translation_refs.find(
          (item): item is ContentTranslations =>
            typeof item === "object" && item !== null && "title" in item
        )
      : null;

    const title = (translation?.title ?? "").toLowerCase();
    const description = (translation?.description ?? "").toLowerCase();

    const matchesSearch =
      !query || title.includes(query) || description.includes(query);

    const matchesCategory = category === "All";

    return matchesSearch && matchesCategory;
  });
}

export const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.VERCEL_ENV === "production";

/**
 * Return `candidate` if it is a same-origin relative path safe to redirect to,
 * otherwise return `fallback`. Prevents open-redirect abuse of any
 * caller-supplied `redirect` / `redirectTo` query parameters.
 *
 * Accepts: "/", "/foo", "/foo/bar?x=1#y"
 * Rejects: "//evil.com", "http://evil.com", "https://evil.com",
 *          "javascript:…", "\\evil.com", absolute or scheme-relative URLs.
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/"
): string {
  if (!candidate) {
    return fallback;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(candidate);
  } catch {
    return fallback;
  }

  const trimmed = decoded.trim();
  if (trimmed.length === 0) {
    return fallback;
  }

  // Must be a single-slash absolute path. Reject scheme-relative ("//host"),
  // backslash variants ("/\\host"), and anything containing a scheme.
  if (!trimmed.startsWith("/")) {
    return fallback;
  }
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return fallback;
  }
  if (SCHEME_RELATIVE_RE.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}
