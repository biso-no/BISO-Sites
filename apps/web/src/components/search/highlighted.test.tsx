import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Highlighted } from "./highlighted";

const EXPECTED =
  /^<span><mark class="[^"]*bg-marker[^"]*">Winter<\/mark> Games<\/span>$/;

describe("Highlighted", () => {
  it("wraps only matched text in <mark>", () => {
    const html = renderToStaticMarkup(
      <Highlighted
        segments={[
          { match: true, text: "Winter" },
          { match: false, text: " Games" },
        ]}
      />
    );
    expect(html).toMatch(EXPECTED);
  });

  it("escapes markup in segments", () => {
    const html = renderToStaticMarkup(
      <Highlighted segments={[{ match: true, text: "<b>x</b>" }]} />
    );
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>");
  });
});
