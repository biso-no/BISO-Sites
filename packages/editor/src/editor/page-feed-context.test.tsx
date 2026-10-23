import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { EventsRender } from "@/blocks/events/render";
import type { EventsBlock } from "@/editor/types";
import { PageFeedProvider } from "./page-feed-context";
import { type PageFeedSnapshot, pageFeedKey } from "./page-feeds";
import { useEditorStore } from "./store";

const LIVE_TITLE = "Kickoff at Nydalen";
const LIVE_ITEM = {
  href: "/events/kickoff",
  id: "e1",
  startsAt: "2026-11-01T18:00:00.000Z",
  title: LIVE_TITLE,
  where: "Nydalen",
};
const KEY = pageFeedKey("events", "25", "no", 3);

function eventsBlock(): EventsBlock {
  return {
    id: "b-events",
    type: "events",
    heading: "Coming up",
    limit: 3,
    seeAll: true,
    source: "auto",
  };
}

function render(
  department: string | null,
  feeds?: PageFeedSnapshot,
  edit = false
) {
  const block = (
    <EventsRender block={eventsBlock()} edit={edit} onPatch={() => undefined} />
  );
  return renderToStaticMarkup(
    department === null ? (
      block
    ) : (
      <PageFeedProvider department={department} feeds={feeds} locale="no">
        {block}
      </PageFeedProvider>
    )
  );
}

describe("auto-source feed state during server rendering", () => {
  test("a provided department reaches the block's server render", () => {
    // Unresolved: the site renders nothing (no invented rows, no "Loading…"
    // for crawlers); the editor says it is loading, for that department.
    expect(render("25")).toBe("");
    expect(render("25", undefined, true)).toContain("Loading…");
  });

  test("no department renders nothing on the site", () => {
    expect(render("")).toBe("");
    expect(render("", undefined, true)).toContain("Choose a department");
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

    const html = render(null, undefined, true);

    expect(useEditorStore.getState().doc.meta.department).toBe("25");
    expect(html).toContain("Choose a department");
  });
});

describe("host-resolved feeds during server rendering", () => {
  test("a resolved feed puts real rows in the server HTML", () => {
    const html = render("25", { [KEY]: [LIVE_ITEM] });

    expect(html).toContain(LIVE_TITLE);
    expect(html).toContain("Nydalen");
    expect(html).not.toContain("Loading…");
  });

  test("a feed resolved to zero rows is done, not loading", () => {
    expect(render("25", { [KEY]: [] })).toBe("");
    const html = render("25", { [KEY]: [] }, true);
    expect(html).toContain("No upcoming events for 25");
    expect(html).not.toContain("Loading…");
  });

  test("a feed keyed for another department, locale or limit is not used", () => {
    // The host and the block derive the key independently. If they ever drift
    // apart the block must fall back to fetching rather than render another
    // feed's events, so this guards the key contract in every direction.
    const wrong = [
      pageFeedKey("events", "41", "no", 3),
      pageFeedKey("events", "25", "en", 3),
      pageFeedKey("events", "25", "no", 6),
      pageFeedKey("events", "25", "no"),
    ];
    for (const key of wrong) {
      const html = render("25", { [key]: [LIVE_ITEM] }, true);
      expect(html).not.toContain(LIVE_TITLE);
      expect(html).toContain("Loading…");
    }
  });

  test("resolved feeds for another department never render without one", () => {
    const html = render("", {
      [pageFeedKey("events", "", "no", 3)]: [LIVE_ITEM],
    });
    expect(html).toBe("");
  });
});
