import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { StatsBlock } from "@/editor/types";
import { StatsRender } from "./render";

const VIEWPORT_VARIANT = /(?<![@\w])(sm|md|lg|xl):/;

const block: StatsBlock = {
  id: "s1",
  items: [
    { label: "Members", num: "12 000" },
    { label: "Events", num: "48" },
  ],
  type: "stats",
};

describe("StatsRender", () => {
  test("uses container-query columns, never a viewport variant", () => {
    const html = renderToStaticMarkup(
      createElement(
        "section",
        { "data-surface": "deep" },
        createElement(StatsRender, {
          block,
          edit: false,
          onPatch: () => undefined,
        })
      )
    );
    expect(html).toContain("@sm:grid-cols-2");
    expect(html).not.toMatch(VIEWPORT_VARIANT);
    expect(html).toContain("type-data");
    expect(html).toContain("text-ink-accent");
    expect(html).toContain("12 000");
  });
});
