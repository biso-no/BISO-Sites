import { PlateContentRenderer } from "@repo/ui/components/plate-content-renderer";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

// The event that showed the bug: a pasted Tickster link, 300+ characters with
// nowhere to break, ran out of the description column and across the sidebar.
const LONG_URL = `https://secure.tickster.com/no/6d0g6ubjeg3tw51/products?utm_source=ig&fbclid=${"PAZXh0bgNhZW0CMTEAcGRvZgJ".repeat(8)}`;

const ARTICLE_CLASS = /<article class="([^"]*)"/;

// Static markup escapes the `&` in `[&_table]:` as `&amp;`.
const articleClass = (value: string): string =>
  (
    renderToStaticMarkup(<PlateContentRenderer value={value} />).match(
      ARTICLE_CLASS
    )?.[1] ?? ""
  ).replaceAll("&amp;", "&");

describe("PlateContentRenderer", () => {
  it("lets a long unbroken token in HTML wrap inside its column", () => {
    const classes = articleClass(
      `<p>Kjøp billettene dine her: ${LONG_URL}</p>`
    );
    expect(classes.split(" ")).toContain("wrap-anywhere");
  });

  it("does the same for Plate JSON content", () => {
    const value = JSON.stringify([
      {
        children: [{ text: `Kjøp billettene dine her: ${LONG_URL}` }],
        type: "p",
      },
    ]);
    expect(articleClass(value).split(" ")).toContain("wrap-anywhere");
  });

  it("keeps tables on normal wrapping so a wide one scrolls", () => {
    expect(articleClass("<p>x</p>").split(" ")).toContain(
      "[&_table]:wrap-normal"
    );
  });
});
