import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { StepGridBlock } from "@/editor/types";
import { StepGridRender } from "./render";

const block: StepGridBlock = {
  heading: "Slik gjør du det",
  id: "s1",
  items: [
    { body: "A", title: "Meld deg på" },
    { body: "B", title: "Velg enhet" },
    { body: "C", title: "Møt opp" },
  ],
  type: "stepGrid",
};

describe("StepGridRender", () => {
  test("is an ordered list numbered from 1 by index", () => {
    const html = renderToStaticMarkup(
      createElement(
        "section",
        { "data-surface": "deep" },
        createElement(StepGridRender, {
          block,
          edit: false,
          onPatch: () => undefined,
        })
      )
    );
    expect(html).toContain("<ol");
    expect(html.match(/>1</g)).toHaveLength(1);
    expect(html).toContain(">2<");
    expect(html).toContain(">3<");
    expect(html).toContain("type-display-sm");
    expect(html).toContain("text-ink-accent");
    expect(html).toContain("@3xl:grid-cols-3");
  });
});
