import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import ThemedPageBlocksPage, { metadata } from "./page";

test("the themed gallery puts the sample theme before the content and is noindex", () => {
  const html = renderToStaticMarkup(<ThemedPageBlocksPage />);
  expect(html).toContain("<style>:root{");
  expect(html).toContain("--biso-deep:#3b1c6b");
  expect(html.indexOf("<style>")).toBeLessThan(html.indexOf("<header"));
  expect(metadata.robots).toEqual({ index: false, follow: false });
});
