import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ButtonsRender } from "@/blocks/buttons/render";
import { CalloutRender } from "@/blocks/callout/render";
import { CtaBandRender } from "@/blocks/ctaBand/render";
import { FactsRender } from "@/blocks/facts/render";
import { FaqRender } from "@/blocks/faq/render";
import { HighlightsRender } from "@/blocks/highlights/render";
import { QuoteRender } from "@/blocks/quote/render";
import { StatsRender } from "@/blocks/stats/render";
import { StepGridRender } from "@/blocks/stepGrid/render";
import { TabsRender } from "@/blocks/tabs/render";
import { TextRender } from "@/blocks/text/render";
import { TimelineRender } from "@/blocks/timeline/render";
import { PageFeedProvider } from "@/editor/page-feed-context";
import { emptyHeader } from "@/header/empty-header";
import { PageHeaderView } from "@/header/page-header-view";

const noop = () => undefined;

// Each block with its content emptied, the way an editor leaves it.
const CASES: [string, React.ComponentType<never>, Record<string, unknown>][] = [
  ["faq", FaqRender, { heading: "", id: "b", items: [], type: "faq" }],
  ["tabs", TabsRender, { id: "b", tabs: [], type: "tabs" }],
  ["timeline", TimelineRender, { heading: "", id: "b", items: [] }],
  ["stepGrid", StepGridRender, { heading: "", id: "b", items: [] }],
  ["highlights", HighlightsRender, { id: "b", items: [] }],
  ["facts", FactsRender, { id: "b", items: [] }],
  ["stats", StatsRender, { id: "b", items: [] }],
  ["buttons", ButtonsRender, { align: "left", id: "b", items: [] }],
  [
    "text",
    TextRender,
    {
      body: [
        { text: "", type: "h" },
        { text: "<p></p>", type: "p" },
        { text: "  <br>&nbsp; ", type: "p" },
      ],
      id: "b",
    },
  ],
  [
    "quote",
    QuoteRender,
    { author: " ", id: "b", role: "", text: "  ", type: "quote" },
  ],
  [
    "callout",
    CalloutRender,
    { body: "", id: "b", title: " ", tone: "info", type: "callout" },
  ],
  [
    "ctaBand",
    CtaBandRender,
    { buttons: [], eyebrow: "", id: "b", text: "", title: "" },
  ],
];

const render = (
  Component: React.ComponentType<never>,
  block: unknown,
  edit: boolean
) => {
  const Block = Component as React.ComponentType<{
    block: unknown;
    edit: boolean;
    onPatch: () => void;
  }>;
  return renderToStaticMarkup(
    <PageFeedProvider department="" locale="no">
      <Block block={block} edit={edit} onPatch={noop} />
    </PageFeedProvider>
  );
};

describe("empty blocks on the site", () => {
  test.each(
    CASES
  )("%s renders nothing when its content is empty", (_name, Component, block) => {
    expect(render(Component, block, false)).toBe("");
  });

  test.each(
    CASES
  )("%s keeps its placeholder in the editor", (_name, Component, block) => {
    expect(render(Component, block, true)).not.toBe("");
  });

  test("a text block with real text still renders", () => {
    const html = render(
      TextRender,
      { body: [{ text: "<p>Hei</p>", type: "p" }], id: "b" },
      false
    );
    expect(html).toContain("Hei");
  });
});

describe("localised accessibility labels", () => {
  const tabs = {
    id: "b",
    tabs: [{ body: "x", label: "A" }],
    type: "tabs",
  };
  const withLocale = (locale: "no" | "en", node: React.ReactNode) =>
    renderToStaticMarkup(
      <PageFeedProvider department="" locale={locale}>
        {node}
      </PageFeedProvider>
    );

  test("tabs", () => {
    const node = (
      <TabsRender block={tabs as never} edit={false} onPatch={noop} />
    );
    expect(withLocale("no", node)).toContain('aria-label="Faner"');
    expect(withLocale("en", node)).toContain('aria-label="Tabs"');
  });

  test("page header breadcrumb", () => {
    const node = (
      <PageHeaderView
        edit={false}
        header={{ ...emptyHeader("T"), crumbs: [{ label: "Hjem" }] }}
        onPatch={noop}
      />
    );
    expect(withLocale("no", node)).toContain('aria-label="Brødsmulesti"');
    expect(withLocale("en", node)).toContain('aria-label="Breadcrumb"');
  });
});
