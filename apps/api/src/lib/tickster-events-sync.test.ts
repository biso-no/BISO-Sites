import { describe, expect, it, vi } from "vitest";
import {
  getTicksterEventsSyncConfig,
  syncTicksterEvents,
  type TicksterEventsSyncConfig,
} from "./tickster-events-sync";

const EXPECTED_SLUG = /^biso-konsert-g1abc/;

// `NodeJS.ProcessEnv` is augmented in this repo to require `NODE_ENV`; the sync's
// config reader only ever indexes by key, so cast partial literals for the tests.
function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

function baseConfig(
  overrides: Partial<TicksterEventsSyncConfig> = {}
): TicksterEventsSyncConfig {
  return {
    apiKey: "test-key",
    databaseId: "app",
    enrich: true,
    eventsTableId: "events",
    hierarchyTypes: ["event"],
    queries: [
      { campusId: "1", label: "Oslo", query: 'by:"BISO Oslo"' },
      { campusId: "2", label: "Bergen", query: 'by:"BISO Bergen"' },
    ],
    status: "published",
    take: 50,
    translationsTableId: "content_translations",
    ...overrides,
  };
}

function listItem(
  languageCode: string,
  overrides: Record<string, unknown> = {}
) {
  const isEn = languageCode === "en";
  return {
    description: {
      html: isEn ? "<p>English body</p>" : "<p>Norsk tekst</p>",
      markdown: null,
    },
    endUtc: "2026-07-01T20:00:00.000Z",
    eventHierarchyType: "event",
    id: "g1abc",
    infoUrl: "https://www.tickster.com/sv/events/g1abc",
    lastUpdatedUtc: "2026-06-20T00:00:00.000Z",
    name: isEn ? "BISO Concert" : "BISO Konsert",
    organizer: {
      country: "NO",
      defaultLanguage: "nb",
      id: "o1",
      name: "BISO Oslo",
    },
    parentEventId: "",
    shopUrl: "https://secure.tickster.com/g1abc",
    startUtc: "2026-07-01T18:00:00.000Z",
    state: "releasedForSale",
    venue: {
      address: "Karl Johans gate 1",
      city: "Oslo",
      country: "NO",
      geo: { latitude: 59.9, longitude: 10.7 },
      id: "v1",
      name: "Aula",
      zipCode: "0123",
    },
    ...overrides,
  };
}

function detailFor(id = "g1abc") {
  return {
    ...listItem("nb"),
    accessibilityInfo: null,
    ageLimit: null,
    curfewUtc: null,
    doorsOpenUtc: null,
    duration: null,
    id,
    imageUrl: "https://static.tickster.com/7b/abc123",
    localizedShopUrls: null,
    performers: [],
    products: [
      {
        description: null,
        mainImageUrl: null,
        name: "Standard",
        price: { amount: 200, currency: "NOK" },
        productType: "ticket",
        variants: [
          { name: "Early bird", price: { amount: 150, currency: "NOK" } },
        ],
      },
    ],
    stockLevel: "instock",
    tags: [],
  };
}

describe("getTicksterEventsSyncConfig", () => {
  it("returns null without an API key", () => {
    expect(getTicksterEventsSyncConfig(env({}))).toBeNull();
  });

  it("falls back to TICKSTER_API_KEY and applies defaults", () => {
    const config = getTicksterEventsSyncConfig(env({ TICKSTER_API_KEY: "k" }));
    expect(config).not.toBeNull();
    expect(config?.apiKey).toBe("k");
    expect(config?.status).toBe("published");
    expect(config?.take).toBe(50);
    expect(config?.enrich).toBe(true);
    expect(config?.hierarchyTypes).toEqual(["event"]);
    expect(config?.queries).toHaveLength(5);
    expect(config?.queries[0]).toMatchObject({ campusId: "1" });
  });

  it("parses a custom campus query map and disables enrichment", () => {
    const config = getTicksterEventsSyncConfig(
      env({
        TICKSTER_EVENTS_API_KEY: "k",
        TICKSTER_EVENTS_ENRICH: "false",
        TICKSTER_EVENTS_STATUS: "draft",
        TICKSTER_EVENTS_QUERY_MAP: JSON.stringify([
          { campusId: "1", label: "Oslo", query: "by:Org" },
        ]),
      })
    );
    expect(config?.enrich).toBe(false);
    expect(config?.status).toBe("draft");
    expect(config?.queries).toEqual([
      { campusId: "1", label: "Oslo", query: "by:Org" },
    ]);
  });
});

describe("syncTicksterEvents", () => {
  function makeDb() {
    const createRow = vi.fn().mockResolvedValue({});
    // Simulate first-run: nothing to update yet → 404 → create.
    const updateRow = vi.fn().mockRejectedValue({ code: 404 });
    return { createRow, db: { createRow, updateRow }, updateRow };
  }

  function makeClient() {
    return {
      getEvent: vi.fn().mockResolvedValue(detailFor()),
      listEvents: vi.fn(({ languageCode, query }) => {
        if (typeof query === "string" && query.includes("Oslo")) {
          return { items: [listItem(languageCode)], skipped: 0, totalItems: 1 };
        }
        return { items: [], skipped: 0, totalItems: 0 };
      }),
    };
  }

  it("upserts an enriched event row with both translations", async () => {
    const { createRow, db } = makeDb();
    const client = makeClient();

    const result = await syncTicksterEvents({
      client: client as never,
      config: baseConfig(),
      db: db as never,
      now: () => new Date("2026-06-25T00:00:00.000Z"),
    });

    expect(result.upserted).toBe(1);
    expect(result.translationsUpserted).toBe(2);
    expect(result.failed).toHaveLength(0);

    const eventCreate = createRow.mock.calls.find(
      ([args]) => args.tableId === "events"
    )?.[0];
    expect(eventCreate.rowId).toBe("tkstg1abc");
    expect(eventCreate.data).toMatchObject({
      campus_id: "1",
      status: "published",
      image: "https://static.tickster.com/7b/abc123",
      ticket_url: "https://secure.tickster.com/g1abc",
      price: 150,
      location: "Aula, Oslo",
      start_date: "2026-07-01T18:00:00.000Z",
    });
    expect(eventCreate.data.slug).toMatch(EXPECTED_SLUG);
    expect(eventCreate.permissions).toContain('read("any")');
    const metadata = JSON.parse(eventCreate.data.metadata);
    expect(metadata).toMatchObject({
      source: "tickster",
      tickster_id: "g1abc",
    });

    const translationCreates = createRow.mock.calls
      .map(([args]) => args)
      .filter((args) => args.tableId === "content_translations");
    expect(translationCreates).toHaveLength(2);
    const noRow = translationCreates.find((a) => a.data.locale === "no");
    const enRow = translationCreates.find((a) => a.data.locale === "en");
    expect(noRow.rowId).toBe("tkstg1abcno");
    expect(noRow.data).toMatchObject({
      content_id: "tkstg1abc",
      content_type: "event",
      event_ref: "tkstg1abc",
      title: "BISO Konsert",
    });
    expect(enRow.data).toMatchObject({
      event_ref: "tkstg1abc",
      title: "BISO Concert",
      description: "<p>English body</p>",
    });
  });

  it("deduplicates an event returned by more than one campus query", async () => {
    const { createRow, db } = makeDb();
    // Both campus queries return the same Tickster event id.
    const client = {
      getEvent: vi.fn().mockResolvedValue(detailFor()),
      listEvents: vi.fn(({ languageCode }) => ({
        items: [listItem(languageCode)],
        skipped: 0,
        totalItems: 1,
      })),
    };

    const result = await syncTicksterEvents({
      client: client as never,
      config: baseConfig(),
      db: db as never,
    });

    expect(result.upserted).toBe(1);
    expect(result.skipped).toBe(1);
    const eventCreates = createRow.mock.calls.filter(
      ([args]) => args.tableId === "events"
    );
    expect(eventCreates).toHaveLength(1);
  });

  it("skips hierarchy types that are not configured", async () => {
    const { createRow, db } = makeDb();
    const client = {
      getEvent: vi.fn().mockResolvedValue(detailFor()),
      listEvents: vi.fn(({ languageCode, query }) => {
        if (typeof query === "string" && query.includes("Oslo")) {
          return {
            items: [
              listItem(languageCode, { eventHierarchyType: "collection" }),
            ],
            skipped: 0,
            totalItems: 1,
          };
        }
        return { items: [], skipped: 0, totalItems: 0 };
      }),
    };

    const result = await syncTicksterEvents({
      client: client as never,
      config: baseConfig(),
      db: db as never,
    });

    expect(result.upserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(createRow).not.toHaveBeenCalled();
  });

  it("continues without enrichment when detail fetch fails", async () => {
    const { createRow, db } = makeDb();
    const client = makeClient();
    client.getEvent = vi.fn().mockRejectedValue(new Error("429"));

    const result = await syncTicksterEvents({
      client: client as never,
      config: baseConfig(),
      db: db as never,
    });

    expect(result.upserted).toBe(1);
    const eventCreate = createRow.mock.calls.find(
      ([args]) => args.tableId === "events"
    )?.[0];
    expect(eventCreate.data.image).toBeNull();
    expect(eventCreate.data.price).toBeNull();
  });
});
