import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSummary, readingMinutes } from "@/lib/news-article";

const here = join(process.cwd(), "src/components/news/v2");
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /^\s*\/\/.*$/gm;

/** Doc comments name the v1 behaviour being replaced, so assertions read code. */
function code(file: string): string {
  return readFileSync(join(here, file), "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "");
}

const listSource = code("news-v2.tsx");
const detailSource = code("news-detail-v2.tsx");
const searchSource = code("news-search.tsx");
const schemaSource = code("news-article-schema.tsx");

const pageSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("PLACEHOLDER-003 — no invented categories", () => {
  it("renders no category pill and offers no category chip", () => {
    // `News` has no category column, only an untyped `metadata: string[]` that
    // is empty on every published row. The reference's EVENT RECAP / STUDENT
    // STORIES / CAMPUS NEWS pills have nothing behind them.
    expect(listSource).not.toContain("category");
    expect(listSource).not.toContain("metadata");
    expect(detailSource).not.toContain("category");
  });

  it("classifies only by `sticky`, which the data does carry", () => {
    expect(listSource).toContain("article.sticky");
  });
});

describe("news list structure", () => {
  it("keeps the search parameter server-readable and its URL shareable", () => {
    expect(searchSource).toContain('method="get"');
    expect(searchSource).toContain('action="/news"');
    expect(searchSource).toContain('name="search"');
    // A native submit must still happen when the script is present, so the
    // analytics handler must not cancel it.
    expect(searchSource).not.toContain("preventDefault");
  });

  it("never sends the query itself to analytics", () => {
    expect(searchSource).toContain("queryLength");
    expect(searchSource).not.toContain("query: value");
  });

  it("links every card to the article route", () => {
    expect(listSource).toContain(
      ["href={`/news/", "{article.slug}`}"].join("$")
    );
  });

  it("carries no whileInView or motion import", () => {
    for (const source of [listSource, detailSource, searchSource]) {
      expect(source).not.toContain("whileInView");
      expect(source).not.toContain("motion/react");
    }
  });
});

describe("news detail structure", () => {
  it("keeps the NewsArticle structured data", () => {
    expect(schemaSource).toContain('"@type": "NewsArticle"');
    expect(schemaSource).toContain("serializeJsonLd");
    expect(detailSource).toContain("<NewsArticleSchema");
  });

  it("sets the body at the measured --measure, not a raw ch value", () => {
    // 68ch does not render 68 characters: `ch` is the advance of "0", wider
    // than average prose. `<Prose>` carries `--measure`, which was tuned by
    // counting rendered characters.
    expect(detailSource).toContain("<Prose>");
    expect(detailSource).not.toContain("max-w-[68ch]");
    expect(detailSource).not.toContain("max-w-4xl");
  });

  it("keeps the meta rail sticky only where there is a column for it", () => {
    expect(detailSource).toContain("lg:sticky lg:top-24");
    expect(detailSource).toContain(
      "lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]"
    );
  });

  it("reports the campus and unit the row already carried", () => {
    expect(detailSource).toContain("article.campus?.name");
    expect(detailSource).toContain("article.department?.Name");
  });
});

describe("locale resolution on the feeds", () => {
  // `getUserPreferences()` carries no locale until the visitor sets one, and
  // the `?? "en"` fallback disagreed with DEFAULT_LOCALE ("no") — a first visit
  // got Norwegian chrome over English article titles.
  const feeds = [
    "src/app/(public)/news/page.tsx",
    "src/app/(public)/jobs/page.tsx",
    "src/app/(public)/shop/page.tsx",
  ];

  it("reads the locale from getLocale on every feed", () => {
    for (const feed of feeds) {
      const source = pageSource(feed);
      expect(source, feed).toContain("getLocale()");
      expect(source, feed).not.toContain('prefs?.locale ?? "en"');
    }
  });
});

describe("article text helpers", () => {
  it("prefers an authored summary over the body opening", () => {
    expect(buildSummary("A written summary.", "The body starts here.")).toBe(
      "A written summary."
    );
  });

  it("stands the body opening in as an excerpt when nothing was authored", () => {
    expect(buildSummary(null, "x".repeat(500))).not.toBe("");
  });

  it("never repeats the body opening as a lede above the body itself", () => {
    // `buildLead` would return the first 200 characters of the article, cut
    // mid-word, directly above that same paragraph. The header uses the
    // authored summary or nothing.
    expect(detailSource).not.toContain("buildLead");
    expect(detailSource).toContain("translation?.short_description?.trim()");
  });

  it("never reports a reading time of zero", () => {
    expect(readingMinutes("")).toBe(1);
    expect(readingMinutes("one two three")).toBe(1);
  });
});

describe("news message bundle", () => {
  const bundle = (locale: string) =>
    JSON.parse(
      readFileSync(
        join(process.cwd(), `../../packages/i18n/messages/${locale}/news.json`),
        "utf8"
      )
    ) as Record<string, Record<string, string>>;

  it("keeps the two locales at key parity", () => {
    const flatten = (value: unknown, prefix = ""): string[] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, child]) =>
            flatten(child, `${prefix}${key}.`)
          )
        : [prefix];
    expect(flatten(bundle("en")).sort()).toEqual(flatten(bundle("no")).sort());
  });

  it("translates the strings v1 hardcoded in English", () => {
    // `no-results.tsx`: "No articles found" / "Try adjusting your filters or
    // search query" / "Clear Filters", rendered to Norwegian readers as-is.
    for (const locale of ["en", "no"]) {
      const list = bundle(locale).list;
      expect(list?.emptyTitle, locale).toBeTruthy();
      expect(list?.emptyBody, locale).toBeTruthy();
      expect(list?.clear, locale).toBeTruthy();
    }
    expect(bundle("no").list?.emptyTitle).not.toBe(
      bundle("en").list?.emptyTitle
    );
  });
});
