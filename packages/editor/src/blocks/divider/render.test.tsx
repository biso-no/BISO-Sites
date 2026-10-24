import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DividerBlock } from "@/editor/types";
import { DividerRender } from "./render";

const render = (spacing: DividerBlock["spacing"]) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(DividerRender, {
        block: { id: "d1", spacing, type: "divider" },
        edit: false,
        onPatch: () => undefined,
      })
    )
  );

describe("DividerRender", () => {
  test("large spacing renders my-12", () => {
    const html = render("large");
    expect(html).toContain("<hr");
    expect(html).toContain("my-12");
    expect(html).toContain("border-edge");
  });
  test("small and medium use my-4 and my-8", () => {
    expect(render("small")).toContain("my-4");
    expect(render("medium")).toContain("my-8");
  });
});
