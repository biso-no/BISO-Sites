import { EventsPricingMode, EventsStatus } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { OPEN_ENDED } from "../types";
import { eventEntries } from "./event";
import { ctx, noText } from "./fixtures";

type Row = Parameters<typeof eventEntries>[0];

function publishedEvent(overrides: Partial<Row> = {}): Row {
  return {
    $id: "ev1",
    slug: "winter-games-2027",
    status: EventsStatus.PUBLISHED,
    campus_id: "5",
    department_id: "d1",
    start_date: "2027-02-12T10:00:00Z",
    end_date: "2027-02-14T20:00:00Z",
    image: null,
    cover_pattern: "none" as Row["cover_pattern"],
    price: 100,
    member_price: 50,
    pricing_mode: EventsPricingMode.PAID,
    member_only: false,
    location: "Oslo",
    category: null,
    tags: null,
    collection_id: null,
    is_collection: false,
    ...overrides,
  };
}

const now = ctx({ now: new Date("2026-11-23") });

describe("eventEntries", () => {
  it("maps a public event to both locales", () => {
    const e = eventEntries(
      publishedEvent({
        campus_id: "5",
        tags: "ski, fest" as unknown as string[],
      }),
      noText,
      now
    );
    expect(e.map((x) => x.locale)).toEqual(["no", "en"]);
    expect(e[1]).toMatchObject({
      text_locale: "no",
      title: "Vinterleker",
      campus_id: "all",
      url: "/events/winter-games-2027",
      keywords: ["ski", "fest"],
      visible_until: 1_802_635_200,
      type: "event",
      row_id: "ev1",
      synced_at: 1_700_000_000_000,
      department: "Dept d1",
      price: 100,
      member_price: 50,
      location: "Oslo",
    });
  });
  it("accepts array tags", () => {
    expect(
      eventEntries(publishedEvent({ tags: ["a", " b "] }), noText, now)[0]
        .keywords
    ).toEqual(["a", "b"]);
  });
  it("free events price 0", () => {
    expect(
      eventEntries(
        publishedEvent({ pricing_mode: EventsPricingMode.FREE }),
        noText,
        now
      )[0].price
    ).toBe(0);
  });
  it("hides finished events", () => {
    expect(
      eventEntries(
        publishedEvent({ end_date: "2026-01-01T00:00:00Z" }),
        noText,
        now
      )
    ).toEqual([]);
  });
  it("uses start_date when there is no end", () => {
    expect(
      eventEntries(
        publishedEvent({ end_date: null, start_date: "2026-01-01T00:00:00Z" }),
        noText,
        now
      )
    ).toEqual([]);
  });
  it("hides child events of a collection", () => {
    expect(
      eventEntries(
        publishedEvent({ collection_id: "parent1", is_collection: false }),
        noText,
        ctx()
      )
    ).toEqual([]);
  });
  it("keeps the collection itself", () => {
    expect(
      eventEntries(
        publishedEvent({ collection_id: "parent1", is_collection: true }),
        noText,
        now
      )
    ).toHaveLength(2);
  });
  it("hides drafts", () => {
    expect(
      eventEntries(
        publishedEvent({ status: EventsStatus.DRAFT }),
        noText,
        ctx()
      )
    ).toEqual([]);
  });
  it("is open-ended without dates", () => {
    expect(
      eventEntries(
        publishedEvent({ end_date: null, start_date: null }),
        noText,
        ctx()
      )[0].visible_until
    ).toBe(OPEN_ENDED);
  });
  it("needs a slug and a translation", () => {
    expect(eventEntries(publishedEvent({ slug: null }), noText, now)).toEqual(
      []
    );
    expect(eventEntries(publishedEvent(), [], now)).toEqual([]);
  });
});
