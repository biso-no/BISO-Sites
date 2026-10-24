import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { PageFeedProvider } from "@/editor/page-feed-context";
import { type PageFeedSnapshot, pageFeedKey } from "@/editor/page-feeds";
import type { EventsBlock } from "@/editor/types";
import { EventsRender } from "./render";

const block: EventsBlock = {
  heading: "Coming up",
  id: "e1",
  limit: 3,
  seeAll: true,
  source: "auto",
  type: "events",
};

const ITEMS = [
  {
    category: "social",
    date: "1. nov.",
    going: 0,
    href: "/events/pub-night",
    id: "a",
    image: "/images/campus/oslo.png",
    memberOnly: true,
    startsAt: "2026-11-01T18:00:00.000Z",
    ticketUrl: "https://tickets.example/a",
    title: "Pub night",
    where: "Oslo",
  },
  {
    date: "9. nov.",
    going: 0,
    href: "/events/quiz",
    id: "b",
    startsAt: "2026-11-09T18:00:00.000Z",
    title: "Quiz",
    where: "Bergen",
  },
];

function html(
  props: Partial<EventsBlock> = {},
  feeds: PageFeedSnapshot = {},
  options: { department?: string; edit?: boolean; surface?: boolean } = {}
) {
  const { department = "25", edit = false, surface = false } = options;
  const node = (
    <PageFeedProvider department={department} feeds={feeds} locale="no">
      <EventsRender
        block={{ ...block, ...props }}
        edit={edit}
        onPatch={() => undefined}
      />
    </PageFeedProvider>
  );
  return renderToStaticMarkup(
    surface ? <section data-surface="deep">{node}</section> : node
  );
}

const feeds = (limit = 3): PageFeedSnapshot => ({
  [pageFeedKey("events", "25", "no", limit)]: ITEMS,
});

describe("EventsRender", () => {
  test("renders one linked card with a date per feed item", () => {
    const out = html({}, feeds());
    expect(out.match(/<li/g)?.length).toBe(2);
    expect(out).toContain('<a class="group');
    expect(out).toContain('href="/events/pub-night"');
    expect(out).toContain('href="/events/quiz"');
    expect(out).toContain("<time");
    expect(out).toContain("dateTime");
    expect(out).toContain("type-heading-card");
    expect(out).toContain("Pub night");
    expect(out).toContain("Kun for medlemmer");
  });

  test("the heading is a section h2 with a see-all link and the marker", () => {
    const out = html({}, feeds());
    expect(out).toContain('<h2 class="type-heading-section');
    expect(out).toContain("Se alle →");
    expect(out).toContain('href="/events"');
    expect(out).toContain("after:bg-marker");
  });

  test("the category pill is a localized label, never the raw enum", () => {
    const out = html({}, feeds());
    expect(out).toContain("Sosialt");
    expect(out).not.toContain(">social<");
    const junk = html(
      {},
      {
        [pageFeedKey("events", "25", "no", 3)]: [
          { ...ITEMS[0], category: "nonsense" },
        ],
      }
    );
    expect(junk).not.toContain("nonsense");
  });

  test("a blank heading renders no h2 on the site", () => {
    expect(html({ heading: "  " }, feeds())).not.toContain("<h2");
    expect(html({ heading: "" }, feeds(), { edit: true })).toContain("<h2");
  });

  test("seeAll off drops the link", () => {
    const out = html({ seeAll: false }, feeds());
    expect(out).not.toContain("Se alle");
  });

  test("limit slices the items and is part of the feed key", () => {
    expect(
      html(
        { limit: 3 },
        { [pageFeedKey("events", "25", "no", 3)]: [...ITEMS, ...ITEMS] }
      ).match(/<li/g)?.length
    ).toBe(3);
    const six = html({ limit: 6 }, feeds(3));
    expect(six).toBe("");
    expect(html({ limit: 6 }, feeds(6)).match(/<li/g)?.length).toBe(2);
  });

  test("renders nothing on the site for an empty, unresolved or department-less feed", () => {
    expect(html({}, { [pageFeedKey("events", "25", "no", 3)]: [] })).toBe("");
    expect(html({}, {})).toBe("");
    expect(html({}, feeds(), { department: "" })).toBe("");
  });

  test("the editor explains why nothing shows", () => {
    expect(
      html({}, { [pageFeedKey("events", "25", "no", 3)]: [] }, { edit: true })
    ).toContain("No upcoming events for 25");
    expect(html({}, {}, { edit: true })).toContain("Loading…");
    expect(html({}, feeds(), { department: "", edit: true })).toContain(
      "Choose a department"
    );
  });

  test("cards are inert in the editor", () => {
    const out = html({}, feeds(), { edit: true });
    expect(out).not.toContain('href="/events/pub-night"');
    expect(out).toContain("Pub night");
  });

  test("tolerates a missing limit and non-array feed junk", () => {
    const out = html(
      { limit: undefined as never },
      { [pageFeedKey("events", "25", "no", 3)]: [null, "x", ...ITEMS] }
    );
    expect(out.match(/<li/g)?.length).toBe(2);
  });

  test("renders on a dark section with token colours only", () => {
    const out = html({}, feeds(), { surface: true });
    expect(out).toContain("text-ink");
    expect(out).toContain("@md:grid-cols-2");
  });
});
