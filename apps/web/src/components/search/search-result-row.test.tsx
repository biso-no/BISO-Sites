// @vitest-environment happy-dom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FEB_12_2027, searchHit } from "@/test/search-fixtures";

vi.mock("next-intl", () => ({
  useTranslations:
    () => (key: string, values?: Record<string, string | number>) =>
      values ? `${key} ${Object.values(values).join(" ")}` : key,
}));
vi.mock("@repo/ui/components/image", () => ({
  ImageWithFallback: ({ src }: { src: string }) =>
    createElement("img", { alt: "", src }),
}));

import { SearchResultRow } from "./search-result-row";

const COUNT_WORDS = /\d+ (left|pcs|items)/i;

const render = (hit: Parameters<typeof SearchResultRow>[0]["hit"]) =>
  renderToStaticMarkup(<SearchResultRow hit={hit} locale="en" />);

describe("SearchResultRow", () => {
  it("renders an event with a date block, a link and a highlight", () => {
    const html = render(
      searchHit({
        id: "e1",
        group: "event",
        starts_at: FEB_12_2027,
        title: [
          { match: true, text: "Winter" },
          { match: false, text: " Games" },
        ],
        url: "/events/winter-games-2027",
      })
    );
    expect(html).toContain(">12<");
    expect(html).toContain('href="/events/winter-games-2027"');
    expect(html).toContain("<mark");
  });

  it("shows stock state, never a count", () => {
    const html = render(
      searchHit({ id: "p1", group: "product", price: 300, in_stock: false })
    );
    expect(html).toContain("meta.outOfStock");
    expect(html).not.toMatch(COUNT_WORDS);
  });

  it("shows a job deadline and no image", () => {
    const html = render(
      searchHit({ id: "j1", group: "job", deadline: FEB_12_2027 })
    );
    expect(html).toContain("meta.applyBy");
    expect(html).toContain("12");
    expect(html).not.toContain("<img");
  });

  it("shows a page's path as a breadcrumb", () => {
    const html = render(
      searchHit({
        id: "pg1",
        group: "page",
        url: "/projects/winter-games/packing-list",
      })
    );
    expect(html).toContain("biso.no / projects / winter-games / packing-list");
  });
});
