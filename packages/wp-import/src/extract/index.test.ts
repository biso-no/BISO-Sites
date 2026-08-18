import { describe, expect, test } from "bun:test";
import { WpClient } from "../wp/client";
import { extractJobs, extractProducts, parseSince } from "./index";

interface StubRoute {
  body: unknown;
  match: (url: string) => boolean;
}

function stubRoutes(routes: StubRoute[]) {
  return (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    const route = routes.find((candidate) => candidate.match(url));
    if (!route) {
      throw new Error(`unexpected fetch: ${url}`);
    }
    return Promise.resolve(Response.json(route.body));
  };
}

describe("parseSince", () => {
  const now = new Date("2026-08-18T00:00:00.000Z");

  test("parses a month window", () => {
    expect(parseSince("3m", now)).toBe("2026-05-18T00:00:00.000Z");
  });

  test("parses a day window", () => {
    expect(parseSince("30d", now)).toBe("2026-07-19T00:00:00.000Z");
  });

  test("parses a year window", () => {
    expect(parseSince("1y", now)).toBe("2025-08-18T00:00:00.000Z");
  });

  test("passes an explicit ISO date through", () => {
    expect(parseSince("2026-01-01", now)).toBe("2026-01-01T00:00:00.000Z");
  });

  test("returns the epoch for 'all'", () => {
    expect(parseSince("all", now)).toBe("1970-01-01T00:00:00.000Z");
  });

  test("throws on an unparseable window", () => {
    expect(() => parseSince("banana", now)).toThrow("Unrecognised --since");
  });
});

describe("extractJobs", () => {
  test("joins a /custom/v1/jobs record to its awsm_job_openings post by id", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: stubRoutes([
        {
          body: [
            {
              content: { rendered: "<p>Body</p>" },
              date: "2026-01-01T00:00:00",
              date_gmt: "2026-01-01T00:00:00",
              id: 1,
              link: "https://example.test/jobs/finance-officer",
              slug: "finance-officer",
              status: "publish",
              title: { rendered: "Finance Officer" },
            },
          ],
          match: (url) => url.includes("/wp/v2/awsm_job_openings"),
        },
        {
          body: {
            jobs: [
              {
                campus: ["Oslo"],
                department: ["Finance"],
                id: 1,
                verv: ["finance"],
              },
            ],
            pagination: { total_pages: 1 },
          },
          match: (url) => url.includes("/custom/v1/jobs"),
        },
      ]),
    });

    const jobs = await extractJobs(client, "2020-01-01T00:00:00.000Z");

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.campus).toEqual(["Oslo"]);
    expect(jobs[0]?.department).toEqual(["Finance"]);
    expect(jobs[0]?.post.id).toBe(1);
    expect(jobs[0]?.post.slug).toBe("finance-officer");
  });

  test("drops a custom-API job whose id has no matching WP post", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: stubRoutes([
        { body: [], match: (url) => url.includes("/wp/v2/awsm_job_openings") },
        {
          body: {
            jobs: [{ campus: [], department: [], id: 99, verv: [] }],
            pagination: { total_pages: 1 },
          },
          match: (url) => url.includes("/custom/v1/jobs"),
        },
      ]),
    });

    const jobs = await extractJobs(client, "2020-01-01T00:00:00.000Z");

    expect(jobs).toEqual([]);
  });

  test("filters the since-window on date_gmt, not the host machine's timezone", async () => {
    const since = "2026-08-01T00:00:00.000Z";
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: stubRoutes([
        {
          body: [
            {
              // A tz-less `date` that, parsed as the host machine's local
              // time, lands BEFORE `since` — the opposite of the correct
              // answer. Only reading `date_gmt` (AFTER `since`) gets this
              // job included; a regression back to `new Date(post.date)`
              // would drop it and fail this assertion.
              date: "2026-07-31T20:00:00",
              date_gmt: "2026-08-01T01:00:00",
              id: 1,
            },
            {
              date: "2026-07-31T20:00:00",
              date_gmt: "2026-07-31T22:00:00",
              id: 2,
            },
          ],
          match: (url) => url.includes("/wp/v2/awsm_job_openings"),
        },
        {
          body: {
            jobs: [
              { campus: [], department: [], id: 1, verv: [] },
              { campus: [], department: [], id: 2, verv: [] },
            ],
            pagination: { total_pages: 1 },
          },
          match: (url) => url.includes("/custom/v1/jobs"),
        },
      ]),
    });

    const jobs = await extractJobs(client, since);

    expect(jobs.map((job) => job.post.id)).toEqual([1]);
  });
});

describe("extractProducts", () => {
  test("merges /wp/v2/product with /wc/store/v1/products by id, and nulls unmatched", async () => {
    const client = new WpClient({
      baseUrl: "https://example.test",
      fetchImpl: stubRoutes([
        {
          body: [
            {
              acf: { campus: "1" },
              content: { rendered: "<p>Hoodie</p>" },
              id: 1,
              slug: "hoodie",
              status: "publish",
              title: { rendered: "Hoodie" },
            },
            {
              acf: { campus: "1" },
              content: { rendered: "<p>Mug</p>" },
              id: 2,
              slug: "mug",
              status: "publish",
              title: { rendered: "Mug" },
            },
          ],
          match: (url) => url.includes("/wp/v2/product"),
        },
        {
          body: [{ id: 1, name: "Hoodie" }],
          match: (url) => url.includes("/wc/store/v1/products"),
        },
      ]),
    });

    const products = await extractProducts(client);

    expect(products.find((p) => p.id === 1)?.store?.name).toBe("Hoodie");
    expect(products.find((p) => p.id === 2)?.store).toBeNull();
  });
});
