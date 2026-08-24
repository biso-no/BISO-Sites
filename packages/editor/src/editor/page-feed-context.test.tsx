import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventsRender } from "@/blocks/events/render";
import type { EventsBlock } from "@/editor/types";
import { PageFeedProvider } from "./page-feed-context";
import { useEditorStore } from "./store";

const PLACEHOLDER_TITLE = "Placeholder event title";

function eventsBlock(): EventsBlock {
  return {
    id: "b-events",
    type: "events",
    heading: "Coming up",
    source: "auto",
    items: [
      { date: "Soon", title: PLACEHOLDER_TITLE, where: "Where", going: 0 },
    ],
  };
}

function render(department: string | null) {
  const block = createElement(EventsRender, {
    block: eventsBlock(),
    edit: false,
    onPatch: () => undefined,
  });
  return renderToStaticMarkup(
    department === null
      ? block
      : createElement(PageFeedProvider, {
          children: block,
          department,
          locale: "no" as const,
        })
  );
}

describe("auto-source feed state during server rendering", () => {
  test("a provided department reaches the block's server render", () => {
    const html = render("25");

    // With a live department the block must not emit the inspector's
    // placeholder items — those are documented as "shown when no department is
    // set", so serving them is how demo content reached visitors and crawlers.
    expect(html).not.toContain(PLACEHOLDER_TITLE);
    expect(html).toContain("Loading…");
  });

  test("no department still renders the authored placeholders", () => {
    const html = render("");

    expect(html).toContain(PLACEHOLDER_TITLE);
  });

  test("seeding the store is NOT visible to server rendering", () => {
    // zustand passes `api.getInitialState` to `useSyncExternalStore` as the
    // server snapshot, so a host that mutates the singleton during render is
    // invisible to SSR. This is why the provider exists; if this assertion
    // ever flips, the store would be a viable channel again.
    useEditorStore.setState({
      doc: {
        ...useEditorStore.getState().doc,
        meta: { ...useEditorStore.getState().doc.meta, department: "25" },
      },
    });

    const html = render(null);

    expect(useEditorStore.getState().doc.meta.department).toBe("25");
    expect(html).toContain(PLACEHOLDER_TITLE);
  });
});
