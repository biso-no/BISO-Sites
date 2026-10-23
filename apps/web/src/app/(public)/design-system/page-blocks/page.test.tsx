import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import PageBlocksPage from "./page";

const NOTICE =
  /<p[^>]*class="([^"]*)"[^>]*>Eksempelinnhold — ikke et ekte arrangement<\/p>/;

test("the gallery says up front that it is sample content", () => {
  const html = renderToStaticMarkup(<PageBlocksPage />);
  const classes = NOTICE.exec(html)?.[1]?.split(" ") ?? [];
  // A sticky strip under the fixed nav, in the marker's notice colours.
  for (const cls of [
    "sticky",
    "top-20",
    "bg-marker",
    "text-deep",
    "type-label",
  ]) {
    expect(classes).toContain(cls);
  }
  expect(html.indexOf("Eksempelinnhold")).toBeLessThan(html.indexOf("<header"));
});
