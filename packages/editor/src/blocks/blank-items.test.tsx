import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { FactsRender } from "@/blocks/facts/render";
import { FaqRender } from "@/blocks/faq/render";
import { HighlightsRender } from "@/blocks/highlights/render";
import { QuoteRender } from "@/blocks/quote/render";
import { StatsRender } from "@/blocks/stats/render";
import { StepGridRender } from "@/blocks/stepGrid/render";
import { TabsRender } from "@/blocks/tabs/render";
import { TimelineRender } from "@/blocks/timeline/render";
import { PageFeedProvider } from "@/editor/page-feed-context";

const noop = () => undefined;

interface ListCase {
  blank: Record<string, string>;
  component: React.ComponentType<never>;
  key: string;
  name: string;
  real: Record<string, string>;
}

// Every text field of one item, blank vs real.
const LISTS: ListCase[] = [
  {
    blank: { a: "", q: " " },
    component: FaqRender,
    key: "items",
    name: "faq",
    real: { a: "Svar", q: "Spørsmål" },
  },
  {
    blank: { body: "\n", label: "" },
    component: TabsRender,
    key: "tabs",
    name: "tabs",
    real: { body: "Innhold", label: "Fane" },
  },
  {
    blank: { label: "", num: "  " },
    component: StatsRender,
    key: "items",
    name: "stats",
    real: { label: "Medlemmer", num: "5000" },
  },
  {
    blank: { label: "", text: "" },
    component: FactsRender,
    key: "items",
    name: "facts",
    real: { label: "Sted", text: "Oslo" },
  },
  {
    blank: { text: "   " },
    component: HighlightsRender,
    key: "items",
    name: "highlights",
    real: { text: "Gratis kaffe" },
  },
  {
    blank: { label: "", text: "", title: "" },
    component: TimelineRender,
    key: "items",
    name: "timeline",
    real: { label: "2019", text: "Startet", title: "Stiftelse" },
  },
  {
    blank: { body: "", title: " " },
    component: StepGridRender,
    key: "items",
    name: "stepGrid",
    real: { body: "Fyll ut", title: "Søk" },
  },
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

describe("blank items on the site", () => {
  test.each(LISTS)("$name: an item with only blank fields renders nothing", ({
    blank,
    component,
    key,
  }) => {
    expect(render(component, { id: "b", [key]: [blank] }, false)).toBe("");
  });

  test.each(LISTS)("$name: blank items are dropped, the real one stays", ({
    blank,
    component,
    key,
    real,
  }) => {
    const mixed = render(component, { id: "b", [key]: [blank, real] }, false);
    const alone = render(component, { id: "b", [key]: [real] }, false);
    expect(alone).not.toBe("");
    expect(mixed).toBe(alone);
  });

  test.each(LISTS)("$name: the editor keeps blank items", ({
    blank,
    component,
    key,
  }) => {
    expect(render(component, { id: "b", [key]: [blank] }, true)).not.toBe("");
  });
});

describe("quote with blank text", () => {
  const quote = {
    author: "Ada",
    id: "b",
    role: "Leder",
    text: " ",
    type: "quote",
  };

  test("renders nothing on the site even with a name and role", () => {
    expect(render(QuoteRender, quote, false)).toBe("");
  });

  test("still renders in the editor", () => {
    expect(render(QuoteRender, quote, true)).not.toBe("");
  });

  test("renders with real text", () => {
    expect(render(QuoteRender, { ...quote, text: "Hei" }, false)).toContain(
      "Hei"
    );
  });
});
