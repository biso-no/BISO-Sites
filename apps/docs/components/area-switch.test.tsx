import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AreaSegments } from "./area-switch";

const CURRENT_LINK = /<a[^>]*aria-current="page"[^>]*>([^<]*)<\/a>/g;

function currentLinks(html: string): string[] {
  return [...html.matchAll(CURRENT_LINK)].map((match) => match[1] ?? "");
}

test("marks only the active area as the current page", () => {
  const html = renderToStaticMarkup(<AreaSegments active="developers" />);
  expect(html).toContain("Platform guide");
  expect(currentLinks(html)).toEqual(["Developers"]);
});

test("marks nothing outside the areas", () => {
  const html = renderToStaticMarkup(<AreaSegments active={null} />);
  expect(currentLinks(html)).toEqual([]);
});
