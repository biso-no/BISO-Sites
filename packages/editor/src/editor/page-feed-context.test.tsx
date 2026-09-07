import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventsRender } from "@/blocks/events/render";
import type { EventsBlock } from "@/editor/types";
import { PageFeedProvider } from "./page-feed-context";
import { type PageFeedSnapshot, pageFeedKey } from "./page-feeds";
import { useEditorStore } from "./store";

const PLACEHOLDER_TITLE = "Placeholder event title";
const LIVE_TITLE = "Kickoff at Nydalen";

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

function render(department: string | null, feeds?: PageFeedSnapshot) {
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
          feeds,
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

describe("host-resolved feeds during server rendering", () => {
  test("a resolved feed puts real rows in the server HTML", () => {
    // This is the whole point of the feature: the first HTML a crawler or a
    // JavaScript-less visitor receives carries the feed, not "Loading…".
    const html = render("25", {
      [pageFeedKey("events", "25", "no")]: [
        { date: "12 Sep", going: 0, title: LIVE_TITLE, where: "Nydalen" },
      ],
    });

    expect(html).toContain(LIVE_TITLE);
    expect(html).toContain("Nydalen");
    expect(html).not.toContain("Loading…");
    expect(html).not.toContain(PLACEHOLDER_TITLE);
    // A resolved feed is a live feed, so the block keeps its live badge.
    expect(html).toContain("Live feed");
  });

  test("a feed resolved to zero rows renders empty, not loading", () => {
    // A department with nothing coming up is *done*, not pending. Rendering
    // "Loading…" for it would leave a permanent spinner on a published page.
    const html = render("25", { [pageFeedKey("events", "25", "no")]: [] });

    expect(html).toContain("No upcoming events.");
    expect(html).not.toContain("Loading…");
    expect(html).not.toContain(PLACEHOLDER_TITLE);
  });

  test("a feed keyed for another department or locale is not used", () => {
    // The host and the block derive the key independently. If they ever drift
    // apart the block must fall back to fetching rather than render another
    // department's events, so this guards the key contract in both directions.
    const wrongDepartment = render("25", {
      [pageFeedKey("events", "41", "no")]: [
        { date: "12 Sep", going: 0, title: LIVE_TITLE, where: "Nydalen" },
      ],
    });
    const wrongLocale = render("25", {
      [pageFeedKey("events", "25", "en")]: [
        { date: "12 Sep", going: 0, title: LIVE_TITLE, where: "Nydalen" },
      ],
    });

    for (const html of [wrongDepartment, wrongLocale]) {
      expect(html).not.toContain(LIVE_TITLE);
      expect(html).toContain("Loading…");
    }
  });

  test("resolved feeds never override the authored placeholders", () => {
    // A page with no department renders `block.items` regardless of what the
    // host resolved — the two must not be able to fight.
    const html = render("", {
      [pageFeedKey("events", "", "no")]: [
        { date: "12 Sep", going: 0, title: LIVE_TITLE, where: "Nydalen" },
      ],
    });

    expect(html).toContain(PLACEHOLDER_TITLE);
    expect(html).not.toContain(LIVE_TITLE);
  });
});
