import { describe, expect, mock, test } from "bun:test";

mock.module("server-only", () => ({}));

const { TicksterClient } = await import("./client");
const { TicksterEventsClient } = await import("./events-client");

interface Call {
  headers: Record<string, string>;
  url: string;
}

function stubFetch(answer: () => Response) {
  const calls: Call[] = [];
  const fetcher = ((url: string, init: RequestInit) => {
    calls.push({ headers: init.headers as Record<string, string>, url });
    return Promise.resolve(answer());
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

/** A fetch that only settles when its signal aborts. */
const hangingFetch = ((_url: string, init: RequestInit) =>
  new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () =>
      reject(new DOMException("aborted", "AbortError"))
    );
  })) as unknown as typeof fetch;

describe("TicksterClient (CRM)", () => {
  test("asks the organizer's CRM feed with the API key and maps purchases", async () => {
    const { calls, fetcher } = stubFetch(() =>
      json({
        nextCursor: "  ",
        purchases: [
          {
            buyerEmail: "a@example.test",
            buyerName: " Ada ",
            event: 42,
            id: 7,
            phone: "",
            ticket_type: "Student",
          },
          { name: "no reference" },
          {
            created: "2026-01-02T03:04:05Z",
            eventId: "e1",
            orderRef: "  r2  ",
          },
        ],
      })
    );
    const client = new TicksterClient({
      apiKey: "key",
      baseUrl: "https://crm.example.test/",
      eogCode: "EOG",
      fetcher,
    });
    const page = await client.getCrmPurchases("a b");
    expect(calls).toEqual([
      {
        headers: { Accept: "application/json", "X-API-KEY": "key" },
        url: "https://crm.example.test/crm/EOG/a%20b",
      },
    ]);
    expect(page).toEqual({
      nextCursor: "r2",
      purchases: [
        {
          email: "a@example.test",
          eventId: "42",
          name: "Ada",
          phone: null,
          purchasedAt: null,
          reference: "7",
          ticketType: "Student",
        },
        {
          email: null,
          eventId: "e1",
          name: null,
          phone: null,
          purchasedAt: "2026-01-02T03:04:05Z",
          reference: "r2",
          ticketType: null,
        },
      ],
    });
  });

  test("uses an explicit cursor and reads other list keys", async () => {
    const { calls, fetcher } = stubFetch(() =>
      json({ fromPurchase: 99, items: [{ reference: "x" }] })
    );
    const client = new TicksterClient({ apiKey: "k", eogCode: "E", fetcher });
    const page = await client.getCrmPurchases();
    expect(calls[0]?.url).toBe("https://api.tickster.com/crm/E/");
    expect(page.nextCursor).toBe("99");
    expect(page.purchases.map((p) => p.reference)).toEqual(["x"]);
  });

  test("throws with the path and status when Tickster refuses", async () => {
    const { fetcher } = stubFetch(
      () => new Response("", { status: 503, statusText: "Service Unavailable" })
    );
    const client = new TicksterClient({ apiKey: "k", eogCode: "E", fetcher });
    await expect(client.getCrmPurchases("c")).rejects.toThrow(
      "Tickster API /crm/E/c responded 503 Service Unavailable"
    );
  });

  test("aborts a request that outlives the timeout", async () => {
    const client = new TicksterClient({
      apiKey: "k",
      eogCode: "E",
      fetchTimeoutMs: 5,
      fetcher: hangingFetch,
    });
    await expect(client.getCrmPurchases()).rejects.toThrow("aborted");
  });
});

describe("TicksterEventsClient", () => {
  test("searches events with the configured header, capping take", async () => {
    const { calls, fetcher } = stubFetch(() =>
      json({
        items: [
          {
            description: { html: "<p>x</p>", markdown: " " },
            id: 12,
            name: " Party ",
            organizer: { country: "NO", id: "o1" },
            venue: { geo: { latitude: "59.9", longitude: 10.7 }, name: "Hall" },
          },
          { name: "no id" },
          "not a record",
        ],
        skipped: "5",
        totalItems: "",
      })
    );
    const client = new TicksterEventsClient({
      apiKey: "key",
      authHeader: "Authorization",
      baseUrl: "https://events.example.test/",
      fetcher,
      version: "2.0",
    });
    const result = await client.listEvents({
      languageCode: "sv",
      query: "BISO Oslo",
      skip: 5,
      take: 500,
    });
    expect(calls).toEqual([
      {
        headers: { Accept: "application/json", Authorization: "key" },
        url: "https://events.example.test/api/v2.0/sv/events?query=BISO+Oslo&take=100&skip=5",
      },
    ]);
    expect(result).toEqual({
      items: [
        {
          description: { html: "<p>x</p>", markdown: null },
          endUtc: null,
          eventHierarchyType: null,
          id: "12",
          infoUrl: null,
          lastUpdatedUtc: null,
          name: "Party",
          organizer: {
            country: "NO",
            defaultLanguage: null,
            id: "o1",
            name: null,
          },
          parentEventId: null,
          shopUrl: null,
          startUtc: null,
          state: null,
          venue: {
            address: null,
            city: null,
            country: null,
            geo: { latitude: 59.9, longitude: 10.7 },
            id: null,
            name: "Hall",
            zipCode: null,
          },
        },
      ],
      skipped: 5,
      totalItems: 1,
    });
  });

  test("defaults to 20 results, no skip and the X-API-KEY header", async () => {
    const { calls, fetcher } = stubFetch(() => json({}));
    const client = new TicksterEventsClient({ apiKey: "k", fetcher });
    const result = await client.listEvents({ languageCode: "en", skip: 0 });
    expect(calls).toEqual([
      {
        headers: { Accept: "application/json", "X-API-KEY": "k" },
        url: "https://event.api.tickster.com/api/v1.0/en/events?take=20",
      },
    ]);
    expect(result).toEqual({ items: [], skipped: 0, totalItems: 0 });
  });

  test("maps one event's detail", async () => {
    const { calls, fetcher } = stubFetch(() =>
      json({
        ageLimit: 18,
        id: "ev/1",
        localizedShopUrls: { en: " https://shop/en ", sv: "", xx: 3 },
        performers: ["A", " ", 7],
        products: [
          {
            name: "Ticket",
            price: { amount: "150", currency: "NOK" },
            variants: [{ name: "Early", price: { amount: 100 } }, null],
          },
          "bad",
        ],
        tags: "not a list",
      })
    );
    const client = new TicksterEventsClient({ apiKey: "k", fetcher });
    const detail = await client.getEvent("en", "ev/1");
    expect(calls[0]?.url).toBe(
      "https://event.api.tickster.com/api/v1.0/en/events/ev%2F1"
    );
    expect(detail).toMatchObject({
      accessibilityInfo: null,
      ageLimit: "18",
      id: "ev/1",
      localizedShopUrls: { en: "https://shop/en", xx: "3" },
      performers: ["A", "7"],
      products: [
        {
          description: null,
          mainImageUrl: null,
          name: "Ticket",
          price: { amount: 150, currency: "NOK" },
          productType: null,
          variants: [{ name: "Early", price: { amount: 100, currency: null } }],
        },
      ],
      tags: [],
    });
  });

  test("returns null for an event without an id", async () => {
    const { fetcher } = stubFetch(() => json({ name: "x" }));
    const client = new TicksterEventsClient({ apiKey: "k", fetcher });
    expect(await client.getEvent("en", "e")).toBeNull();
  });

  test("throws with the path and status when Tickster refuses", async () => {
    const { fetcher } = stubFetch(
      () => new Response("", { status: 404, statusText: "Not Found" })
    );
    const client = new TicksterEventsClient({ apiKey: "k", fetcher });
    await expect(client.listEvents({ languageCode: "en" })).rejects.toThrow(
      "Tickster Event API /events responded 404 Not Found"
    );
    await expect(client.getEvent("en", "e1")).rejects.toThrow(
      "Tickster Event API /e1 responded 404 Not Found"
    );
  });

  test("aborts a request that outlives the timeout", async () => {
    const client = new TicksterEventsClient({
      apiKey: "k",
      fetchTimeoutMs: 5,
      fetcher: hangingFetch,
    });
    await expect(client.listEvents({ languageCode: "en" })).rejects.toThrow(
      "aborted"
    );
  });
});
