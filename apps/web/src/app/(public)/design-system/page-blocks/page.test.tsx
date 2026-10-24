import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import PageBlocksPage from "./page";

const NOTICE = /<p[^>]*class="([^"]*)"[^>]*>(.*?)<\/p>/;
const SHORT = "Eksempelinnhold";
const LONG = "Eksempelinnhold — ikke et ekte arrangement";

test("the gallery says up front that it is sample content", () => {
  const html = renderToStaticMarkup(<PageBlocksPage />);
  const classes = NOTICE.exec(html)?.[1]?.split(" ") ?? [];
  // A strip fixed under the fixed nav, in the marker's notice colours.
  for (const cls of [
    "fixed",
    "top-20",
    "bg-marker",
    "text-deep",
    "type-label",
  ]) {
    expect(classes).toContain(cls);
  }
  expect(html.indexOf("Eksempelinnhold")).toBeLessThan(html.indexOf("<header"));
});

test("on a phone the strip is one line of short copy, clear of the breadcrumb", () => {
  const html = renderToStaticMarkup(<PageBlocksPage />);
  const [, classes = "", inner = ""] = NOTICE.exec(html) ?? [];
  const tokens = classes.split(" ");
  // One line, cut off rather than wrapped onto the breadcrumb below.
  expect(tokens).toContain("whitespace-nowrap");
  expect(tokens).toContain("truncate");
  // Short copy below the sm breakpoint, the full sentence from it up.
  expect(inner).toContain(`<span class="sm:hidden">${SHORT}</span>`);
  expect(inner).toContain(`<span class="hidden sm:inline">${LONG}</span>`);
});
