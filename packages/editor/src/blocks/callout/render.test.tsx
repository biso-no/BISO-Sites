import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CalloutBlock } from "@/editor/types";
import { CalloutRender } from "./render";

const base: CalloutBlock = {
  body: "Something to know.",
  id: "c1",
  title: "Heads up",
  tone: "info",
  type: "callout",
};

const render = (block: CalloutBlock) =>
  renderToStaticMarkup(
    createElement(
      "section",
      { "data-surface": "deep" },
      createElement(CalloutRender, {
        block,
        edit: false,
        onPatch: () => undefined,
      })
    )
  );

describe("CalloutRender", () => {
  test("warn renders the warning label in the warning tone", () => {
    const html = render({ ...base, tone: "warn" });
    expect(html).toContain("Viktig");
    expect(html).toContain("text-warning");
  });

  test("tip renders the success tone and info the accent", () => {
    expect(render({ ...base, tone: "tip" })).toContain("text-success");
    const info = render(base);
    expect(info).toContain("Info");
    expect(info).toContain("text-ink-accent");
  });

  test("is an aside on the raised surface with ink text", () => {
    const html = render(base);
    expect(html).toContain("<aside");
    expect(html).toContain("bg-surface-raised");
    expect(html).toContain("rounded-biso-md");
    expect(html).toContain("text-ink");
    expect(html).toContain("type-heading-card");
    expect(html).toContain("type-body-sm");
  });
});
