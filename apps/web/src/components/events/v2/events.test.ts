import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EventsCategory, EventsPricingMode } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import { EVENT_CATEGORY_MESSAGE_KEYS } from "@/lib/types/event";
import {
  EVENT_CATEGORIES,
  eventPrice,
  firstPageTotal,
  formatEventDate,
  formatEventTime,
  formatEventTimeRange,
  islandTotalAfterPage,
  isPastEvent,
  parseCategory,
  pickContent,
  rsvpCountParts,
} from "./event-fields";

const here = join(process.cwd(), "src/components/events/v2");

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /^\s*\/\/.*$/gm;
/** A list narrowed on membership — what hid members-only events in v1. */
const MEMBER_FILTER = /\.filter\([^)]*(member_only|isMember)/;
/** Hoisted: Biome forbids building a regex inside an assertion. */
const CLIENT_SORT = /\.sort\(/;

/**
 * The doc comments in these files name the v1 behaviour they replace
 * ("EventDetailModal", "isMember", "events@biso.no"), so an assertion that the
 * behaviour is gone has to read the code rather than the prose about it.
 */
function code(file: string, dir = here): string {
  return readFileSync(join(dir, file), "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "");
}

const listSource = code("events-v2.tsx");
const cardSource = code("event-card-v2.tsx");
const feedSource = code("events-feed-list.tsx");
const detailSource = code("event-detail-v2.tsx");
const ticketSource = code("ticket-link.tsx");
const pageSource = code(
  "page.tsx",
  join(process.cwd(), "src/app/(public)/events")
);
const detailPageSource = code(
  "page.tsx",
  join(process.cwd(), "src/app/(public)/events/[slug]")
);

const dated = (start: string | null, end: string | null = null) => ({
  start_date: start,
  end_date: end,
});

describe("event categories", () => {
  it("offers the eight values the schema actually defines", () => {
    expect(EVENT_CATEGORIES).toHaveLength(8);
    expect(EVENT_CATEGORIES).toContain(EventsCategory.WORKSHOP);
    expect(EVENT_CATEGORIES).toContain(EventsCategory.TRIP);
  });

  it("does not use the five-value list the current filter invents", () => {
    // `Sports` and `Culture` are not values of `EventsCategory`; they only
    // exist in `lib/types/event.ts`, which reads a metadata blob that is null
    // on every published row.
    expect(EVENT_CATEGORIES as string[]).not.toContain("Sports");
    expect(EVENT_CATEGORIES as string[]).not.toContain("Culture");
  });

  it("accepts every enum value from the query string", () => {
    for (const category of EVENT_CATEGORIES) {
      expect(parseCategory(category)).toBe(category);
    }
  });

  it("treats absent, 'all' and unrecognised values as no filter", () => {
    expect(parseCategory(undefined)).toBeNull();
    expect(parseCategory("all")).toBeNull();
    expect(parseCategory("Sports")).toBeNull();
    expect(parseCategory("'; drop table events--")).toBeNull();
  });

  it("reads the first value when a parameter is repeated", () => {
    expect(parseCategory(["party", "talk"])).toBe(EventsCategory.PARTY);
  });
});

describe("feed ordering", () => {
  const now = new Date("2026-09-01T12:00:00Z");

  it("counts an event as past only once it has ended", () => {
    expect(
      isPastEvent(dated("2026-08-30T10:00:00Z", "2026-09-02T10:00:00Z"), now)
    ).toBe(false);
    expect(
      isPastEvent(dated("2026-08-30T10:00:00Z", "2026-08-31T10:00:00Z"), now)
    ).toBe(true);
    expect(isPastEvent(dated("2026-08-30T10:00:00Z"), now)).toBe(true);
    expect(isPastEvent(dated(null), now)).toBe(false);
  });

  it("leaves the order and the finished events to the query", () => {
    // `listEvents({ upcomingOnly: true })` hides finished events and orders by
    // start date in Appwrite, so the order holds across "Load more" pages. A
    // client-side sort could only ever reorder the one page it held.
    expect(pageSource).toContain("upcomingOnly: true");
    expect(feedSource).toContain("upcomingOnly: true");
    for (const source of [listSource, cardSource, feedSource]) {
      expect(source).not.toMatch(CLIENT_SORT);
    }
  });
});

describe("load-more totals", () => {
  const PAGE = 12;

  it("counts a short first page as the whole result", () => {
    // `listRows(...).total` has reported the whole table (see `countRows`).
    expect(firstPageTotal(3, 47, PAGE)).toBe(3);
    expect(firstPageTotal(0, 47, PAGE)).toBe(0);
    expect(firstPageTotal(PAGE, 30, PAGE)).toBe(30);
  });

  it("tracks only the rows after the server-rendered first page", () => {
    expect(
      islandTotalAfterPage({
        firstPageCount: PAGE,
        page: 2,
        pageRows: PAGE,
        pageSize: PAGE,
        reportedTotal: 30,
      })
    ).toBe(18);
  });

  it("ends the list on a short page, whatever the reported total says", () => {
    expect(
      islandTotalAfterPage({
        firstPageCount: PAGE,
        page: 2,
        pageRows: 5,
        pageSize: PAGE,
        reportedTotal: 47,
      })
    ).toBe(5);
    // Page 3 came back empty: the island holds exactly page 2's twelve.
    expect(
      islandTotalAfterPage({
        firstPageCount: PAGE,
        page: 3,
        pageRows: 0,
        pageSize: PAGE,
        reportedTotal: 47,
      })
    ).toBe(PAGE);
  });
});

describe("pricing", () => {
  const base = {
    price: null,
    member_price: null,
    pricing_mode: EventsPricingMode.FREE,
  };

  it("trusts pricing_mode rather than inferring free from a null price", () => {
    expect(eventPrice(base)).toEqual({ kind: "free" });
    expect(
      eventPrice({ ...base, pricing_mode: EventsPricingMode.PAID })
    ).toEqual({ kind: "unknown" });
  });

  it("reads member_price from the column, not the null metadata blob", () => {
    expect(
      eventPrice({
        price: 270,
        member_price: 269,
        pricing_mode: EventsPricingMode.PAID,
      })
    ).toEqual({ kind: "paid", amount: 270, memberAmount: 269 });
  });

  it("does not advertise a member price identical to the public one", () => {
    expect(
      eventPrice({
        price: 270,
        member_price: 270,
        pricing_mode: EventsPricingMode.PAID,
      })
    ).toEqual({ kind: "paid", amount: 270, memberAmount: null });
  });
});

describe("date formatting", () => {
  // The admin editor stores a real UTC instant converted from the Oslo wall
  // clock it was typed in (`osloWallClockToIso`), so 18:00 in Oslo is stored
  // as 16:00Z in summer and 17:00Z in winter, and must read back as 18:00
  // wherever the server happens to run.
  it("prints Oslo wall-clock time, independent of the host zone", () => {
    expect(formatEventTime("2026-10-01T16:00:00.000+00:00", "nb-NO")).toBe(
      "18:00"
    );
    expect(formatEventTime("2026-12-01T17:00:00.000+00:00", "en-GB")).toBe(
      "18:00"
    );
    expect(formatEventDate("2026-10-01T16:00:00.000+00:00", "en-GB")).toContain(
      "1 October 2026"
    );
  });

  it("puts a late-evening UTC instant on the Oslo calendar day", () => {
    // 22:30Z on 30 September is 00:30 on 1 October in Oslo.
    expect(formatEventDate("2026-09-30T22:30:00.000Z", "en-GB")).toContain(
      "1 October 2026"
    );
    expect(formatEventTime("2026-09-30T22:30:00.000Z", "nb-NO")).toBe("00:30");
  });

  it("renders a range only when there is an end", () => {
    expect(
      formatEventTimeRange(
        "2026-10-01T16:00:00.000+00:00",
        "2026-10-01T21:00:00.000+00:00",
        "nb-NO"
      )
    ).toBe("18:00 – 23:00");
    expect(
      formatEventTimeRange("2026-10-01T16:00:00.000+00:00", null, "nb-NO")
    ).toBe("18:00");
    expect(formatEventTimeRange(null, null, "nb-NO")).toBeNull();
  });
});

describe("translation fallback", () => {
  const refs = [
    {
      locale: "no",
      title: "Karrieredagene",
      short_description: null,
      description: "",
    },
    {
      locale: "en",
      title: "Career Days",
      short_description: "Where students meet companies.",
      description: "<p>Norway's leading meeting point.</p>",
    },
  ];

  it("keeps the Norwegian title but falls back per empty field", () => {
    const content = pickContent(refs, "no");
    expect(content.title).toBe("Karrieredagene");
    expect(content.description).toBe("<p>Norway's leading meeting point.</p>");
    expect(content.shortDescription).toBe("Where students meet companies.");
    expect(content.descriptionLocale).toBe("en");
  });

  it("reports no fallback when the requested locale has its own copy", () => {
    const content = pickContent(
      [
        {
          locale: "no",
          title: "Oktoberfest",
          short_description: "På ekte vis!",
          description: "<p>Lederhosen.</p>",
        },
      ],
      "no"
    );
    expect(content.descriptionLocale).toBe("no");
    expect(content.title).toBe("Oktoberfest");
  });

  it("survives a row with no translations at all", () => {
    expect(pickContent(null, "no")).toEqual({
      title: "",
      shortDescription: null,
      description: "",
      descriptionLocale: null,
    });
  });
});

describe("events v2 structure", () => {
  it("links every card to the detail route the modal replaced", () => {
    // `getEventHref` builds `/events/<slug>` and returns null for a row with
    // no usable slug, which the card then shows without a link.
    expect(cardSource).toContain("getEventHref(event)");
    expect(cardSource).toContain("<Link");
    for (const source of [listSource, cardSource, feedSource]) {
      expect(source).not.toContain("EventDetailModal");
    }
  });

  it("renders the same card on the server page and in the load-more island", () => {
    expect(listSource).toContain("<EventCardV2");
    expect(feedSource).toContain("<EventCardV2");
    // The card is imported by a Client Component, so it may not reach for
    // anything server-only.
    expect(cardSource).not.toContain("next-intl/server");
    expect(cardSource).not.toContain("@repo/api/server");
    expect(cardSource).not.toContain("useTranslations");
  });

  it("renders member-only events with a pill instead of hiding them", () => {
    expect(cardSource).toContain("event.member_only");
    expect(cardSource).toContain("labels.membersOnly");
    // `isMember` decides which price a card leads with; it never narrows the
    // list. The query side is pinned in `events-pagination.test.ts`.
    for (const source of [listSource, cardSource, feedSource, pageSource]) {
      expect(source).not.toMatch(MEMBER_FILTER);
    }
  });

  it("filters on the real column, never on parsed metadata", () => {
    expect(pageSource).toContain("parseCategory(sp.category)");
    expect(pageSource).toContain("listEventFacets(");
    for (const source of [listSource, cardSource, detailSource]) {
      expect(source).not.toContain("parseEventMetadata");
    }
  });

  it("pages through the server action with a Load more control", () => {
    expect(feedSource).toContain("useLoadMore");
    expect(feedSource).toContain("<LoadMoreButton");
    expect(feedSource).toContain("listEvents(");
    // A changed filter remounts the island rather than appending to it.
    expect(listSource).toContain("key={`");
    expect(listSource).toContain('t("filters.showingFirstResults"');
  });

  it("searches under q, and still reads the old search parameter", () => {
    expect(pageSource).toContain("parseWebListParams(sp)");
    expect(pageSource).toContain("sp.search");
    expect(listSource).toContain('name="q"');
  });

  it("leaves campus to the header switcher, while ?campus= still scopes", () => {
    // The Branding Committee made the header switcher the one place to change
    // campus (#95), so the feed offers no campus chips of its own.
    expect(listSource).not.toContain('param="campus"');
    // The URL still decides the scope, and both reads honour it.
    expect(pageSource).toContain("resolveRequestCampus(sp.campus");
    expect(pageSource).toContain("campus: campusKey");
    expect(feedSource).toContain("campus,");
    // Searching and picking a category keep the campus already in the URL.
    expect(listSource).toContain('["campus", "category"]');
    expect(listSource).toContain('new Set(["page", "q", "search"])');
  });

  it("derives the ticket state from ticket_url on both views", () => {
    expect(cardSource).toContain("event.ticket_url ?");
    expect(detailSource).toContain("resolveEventRegistration(event)");
    expect(detailSource).toContain("registration.ticketUrl ?");
    expect(ticketSource).toContain('"event_ticket_click"');
  });

  it("offers no registration control when there is nothing to register with", () => {
    // Drop-in events say so; events that take sign-ups without a link say
    // that instead. Neither gets a button.
    expect(detailSource).toContain('t("actions.noRegistrationTitle")');
    expect(detailSource).toContain('t("actions.registrationRequired")');
    expect(detailSource).not.toContain("registerNow");
  });

  it("shows a members-only event to everyone, with the notice", () => {
    expect(detailSource).toContain("<MembersOnlyNotice");
    expect(detailPageSource).toContain("getMembershipStatus()");
    expect(detailPageSource).toContain(
      'membership.reason === "not_authenticated"'
    );
  });

  it("uses the per-event contact rather than a hardcoded address", () => {
    expect(detailSource).toContain("event.contact_email");
    expect(detailSource).toContain('t("infoCards.contactPerson"');
    expect(detailSource).not.toContain("events@biso.no");
  });

  it("keeps the action card sticky only where there is a column for it", () => {
    expect(detailSource).toContain("lg:sticky lg:top-24");
    expect(detailSource).toContain("lg:grid-cols-[minmax(0,1fr)_22rem]");
  });

  it("carries no whileInView anywhere in the events tree", () => {
    for (const source of [listSource, cardSource, feedSource, detailSource]) {
      expect(source).not.toContain("whileInView");
      expect(source).not.toContain("motion/react");
    }
  });
});

describe("events message bundle", () => {
  const bundle = (locale: string) =>
    JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          `../../packages/i18n/messages/${locale}/events.json`
        ),
        "utf8"
      )
    ) as Record<string, Record<string, string>>;

  it("labels all eight categories in both locales", () => {
    for (const locale of ["en", "no"]) {
      const messages = bundle(locale);
      for (const category of EVENT_CATEGORIES) {
        expect(
          messages.category?.[category],
          `${locale}.category.${category}`
        ).toBeTruthy();
        // The chips and pills read `filters.<key>` through main's map.
        const key = EVENT_CATEGORY_MESSAGE_KEYS[category];
        expect(
          messages.filters?.[key],
          `${locale}.filters.${key}`
        ).toBeTruthy();
      }
    }
  });

  it("keeps the two locales at key parity", () => {
    const flatten = (value: unknown, prefix = ""): string[] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, child]) =>
            flatten(child, `${prefix}${key}.`)
          )
        : [prefix];
    expect(flatten(bundle("en")).sort()).toEqual(flatten(bundle("no")).sort());
  });
});

describe("rsvpCountParts", () => {
  it("keeps only the non-zero counts", () => {
    expect(rsvpCountParts({ going: 3, maybe: 0 })).toEqual([
      { count: 3, key: "goingCount" },
    ]);
    expect(rsvpCountParts({ going: 0, maybe: 0 })).toEqual([]);
  });

  it("lists going first", () => {
    expect(rsvpCountParts({ going: 2, maybe: 1 })).toEqual([
      { count: 2, key: "goingCount" },
      { count: 1, key: "maybeCount" },
    ]);
  });
});
