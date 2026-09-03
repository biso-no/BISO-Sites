import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EventsCategory, EventsPricingMode } from "@repo/api/types/appwrite";
import { describe, expect, it } from "vitest";
import {
  EVENT_CATEGORIES,
  eventPrice,
  formatEventDate,
  formatEventTime,
  formatEventTimeRange,
  isPastEvent,
  parseCategory,
  pickContent,
  sortForFeed,
} from "./event-fields";

const here = join(process.cwd(), "src/components/events/v2");

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /^\s*\/\/.*$/gm;

/**
 * The doc comments in these files name the v1 behaviour they replace
 * ("EventDetailModal", "isMember", "events@biso.no"), so an assertion that the
 * behaviour is gone has to read the code rather than the prose about it.
 */
function code(file: string): string {
  return readFileSync(join(here, file), "utf8")
    .replace(BLOCK_COMMENT, "")
    .replace(LINE_COMMENT, "");
}

const listSource = code("events-v2.tsx");
const detailSource = code("event-detail-v2.tsx");

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

  it("puts the soonest upcoming event first and past events last", () => {
    const events = [
      { $id: "past-old", ...dated("2026-01-01T10:00:00Z") },
      { $id: "soon", ...dated("2026-09-22T10:00:00Z") },
      { $id: "past-recent", ...dated("2026-08-26T10:00:00Z") },
      { $id: "later", ...dated("2026-10-01T18:00:00Z") },
    ];
    expect(sortForFeed(events, now).map((event) => event.$id)).toEqual([
      "soon",
      "later",
      "past-recent",
      "past-old",
    ]);
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
  // The stored `+00:00` is a stamp on the editor's wall clock, not a real
  // offset, so 18:00 must read as 18:00 wherever the server happens to run.
  it("prints the wall clock that was typed, independent of the host zone", () => {
    expect(formatEventTime("2026-10-01T18:00:00.000+00:00", "nb-NO")).toBe(
      "18:00"
    );
    expect(formatEventDate("2026-10-01T18:00:00.000+00:00", "en-GB")).toContain(
      "1 October 2026"
    );
  });

  it("renders a range only when there is an end", () => {
    expect(
      formatEventTimeRange(
        "2026-10-01T18:00:00.000+00:00",
        "2026-10-01T23:00:00.000+00:00",
        "nb-NO"
      )
    ).toBe("18:00 – 23:00");
    expect(
      formatEventTimeRange("2026-10-01T18:00:00.000+00:00", null, "nb-NO")
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
    // Assembled rather than written inline: the literal is a template string
    // in the source, and Biome flags `${...}` inside a plain string.
    expect(listSource).toContain(
      ["href={`/events/", "{event.slug}`}"].join("$")
    );
    expect(listSource).not.toContain("EventDetailModal");
  });

  it("renders member-only events with a pill instead of hiding them", () => {
    expect(listSource).toContain("event.member_only");
    expect(listSource).toContain("labels.membersOnly");
    expect(listSource).not.toContain("isMember");
  });

  it("filters on the real column, never on parsed metadata", () => {
    expect(listSource).toContain("event.category === activeCategory");
    expect(listSource).not.toContain("parseEventMetadata");
    expect(detailSource).not.toContain("parseEventMetadata");
  });

  it("derives the ticket state from ticket_url on both views", () => {
    expect(listSource).toContain("event.ticket_url ?");
    expect(detailSource).toContain("event.ticket_url ?");
  });

  it("offers no registration control when there is nothing to register with", () => {
    expect(detailSource).toContain('t("detail.noRegistration")');
    expect(detailSource).not.toContain("registerNow");
  });

  it("uses the per-event contact rather than a hardcoded address", () => {
    expect(detailSource).toContain("event.contact_email");
    expect(detailSource).not.toContain("events@biso.no");
  });

  it("keeps the action card sticky only where there is a column for it", () => {
    expect(detailSource).toContain("lg:sticky lg:top-24");
    expect(detailSource).toContain("lg:grid-cols-[minmax(0,1fr)_22rem]");
  });

  it("carries no whileInView anywhere in the events tree", () => {
    expect(listSource).not.toContain("whileInView");
    expect(detailSource).not.toContain("whileInView");
    expect(listSource).not.toContain("motion/react");
    expect(detailSource).not.toContain("motion/react");
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
