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

const H1 = /<h1/g;

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

  it("offers retry on the error state and the same three links on the empty state", () => {
    const error = renderToStaticMarkup(
      <SearchResultsPage {...base} error response={null} />
    );
    expect(error).toContain("error.retry");
    expect(error).toContain('href="/search?q=winter"');
    const empty = renderToStaticMarkup(
      <SearchResultsPage
        {...base}
        error={false}
        response={emptyPageResponse("winter", "en", null)}
      />
    );
    for (const href of ["/events", "/news", "/jobs"]) {
      expect(empty).toContain(`href="${href}"`);
    }
    expect(empty).not.toContain('href="/shop"');
  });

  it("keeps the chips and a way back when the chosen type is empty", () => {
    const response = {
      ...emptyPageResponse("winter", "en", "job"),
      counts: { event: 4, news: 0, job: 0, product: 0, page: 0, unit: 0 },
    };
    const html = renderToStaticMarkup(
      <SearchResultsPage
        {...base}
        error={false}
        params={{ ...base.params, group: "job" }}
        response={response}
      />
    );
    expect(html).toContain("page.emptyGroup");
    expect(html).not.toContain("empty.title");
    expect(html).toContain("page.filterLabel");
    expect(html).toContain("page.showAllTypes");
    expect(html).toContain('href="/search?q=winter"');
  });

  it("shows the global empty state when no type has hits", () => {
    const html = renderToStaticMarkup(
      <SearchResultsPage
        {...base}
        error={false}
        params={{ ...base.params, group: "job" }}
        response={emptyPageResponse("winter", "en", "job")}
      />
    );
    expect(html).toContain("empty.title");
    expect(html).not.toContain("page.emptyGroup");
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
    expect(without).not.toContain("page.onlyCampus");
    expect(withCampus).toContain("page.onlyCampus");
    // A plain link: no button role, state spoken as text.
    expect(withCampus).not.toContain("aria-pressed");
    expect(withCampus).not.toContain('role="button"');
    expect(withCampus).toContain("page.campusOff");
  });

  it("renders exactly one h1 in every state", () => {
    const results = {
      ...emptyPageResponse("winter", "en", null),
      hits: [searchHit({ id: "a", group: "news" })],
      total: 1,
      total_pages: 1,
      counts: { event: 0, news: 1, job: 0, product: 0, page: 0, unit: 0 },
    };
    const states = [
      <SearchResultsPage {...base} error key="e" response={null} />,
      <SearchResultsPage
        {...base}
        error={false}
        key="z"
        response={emptyPageResponse("winter", "en", null)}
      />,
      <SearchResultsPage {...base} error={false} key="r" response={results} />,
    ];
    for (const state of states) {
      expect(renderToStaticMarkup(state).match(H1)).toHaveLength(1);
    }
  });

  it("offers a way back to page 1 when the page is past the end", () => {
    const response = {
      ...emptyPageResponse("winter", "en", null),
      page: 50,
      total: 30,
      total_pages: 2,
      counts: { event: 0, news: 30, job: 0, product: 0, page: 0, unit: 0 },
    };
    const html = renderToStaticMarkup(
      <SearchResultsPage {...base} error={false} response={response} />
    );
    expect(html).toContain("page.pastEnd");
    expect(html).toContain('href="/search?q=winter"');
    expect(html).not.toContain("page.pageOf");
  });
});
