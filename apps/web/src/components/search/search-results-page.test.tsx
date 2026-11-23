// @vitest-environment happy-dom
import { emptyPageResponse } from "@repo/shared/search/response";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { searchHit } from "@/test/search-fixtures";

vi.mock("next-intl", () => ({
  useTranslations:
    () => (key: string, values?: Record<string, string | number>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
}));
vi.mock("@repo/ui/components/image", () => ({
  ImageWithFallback: () => null,
}));

import { SearchResultsPage } from "./search-results-page";

const base = {
  campusId: null,
  locale: "en" as const,
  params: { q: "winter", group: null, page: 1, onlyCampus: false },
};

describe("SearchResultsPage", () => {
  it("renders the error panel and keeps the form", () => {
    const html = renderToStaticMarkup(
      <SearchResultsPage {...base} error response={null} />
    );
    expect(html).toContain("error.title");
    expect(html).toContain('action="/search"');
    expect(html).toContain('name="q"');
  });

  it("renders the empty state with the query", () => {
    const html = renderToStaticMarkup(
      <SearchResultsPage
        {...base}
        error={false}
        response={emptyPageResponse("winter", "en", null)}
      />
    );
    expect(html).toContain("empty.title winter");
  });

  it("hides pagination for a single page", () => {
    const response = {
      ...emptyPageResponse("winter", "en", null),
      hits: [searchHit({ id: "a", group: "news" })],
      total: 1,
      total_pages: 1,
      counts: { event: 0, news: 1, job: 0, product: 0, page: 0, unit: 0 },
    };
    const html = renderToStaticMarkup(
      <SearchResultsPage {...base} error={false} response={response} />
    );
    expect(html).not.toContain("page.next");
    expect(html).not.toContain("page.previous");
  });

  it("links to the next page when there are more", () => {
    const response = {
      ...emptyPageResponse("winter", "en", null),
      hits: [searchHit({ id: "a", group: "news" })],
      total: 30,
      total_pages: 2,
      counts: { event: 0, news: 30, job: 0, product: 0, page: 0, unit: 0 },
    };
    const html = renderToStaticMarkup(
      <SearchResultsPage {...base} error={false} response={response} />
    );
    expect(html).toContain("/search?q=winter&amp;page=2");
  });

  it("offers the campus switch only with a study campus", () => {
    const response = emptyPageResponse("winter", "en", null);
    const without = renderToStaticMarkup(
      <SearchResultsPage {...base} error={false} response={response} />
    );
    const withCampus = renderToStaticMarkup(
      <SearchResultsPage
        {...base}
        campusId="2"
        error={false}
        response={response}
      />
    );
    expect(without).not.toContain("aria-pressed");
    expect(withCampus).toContain('aria-pressed="false"');
  });
});
