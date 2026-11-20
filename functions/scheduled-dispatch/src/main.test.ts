import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import handler, { monitorSlugFor } from "./main.ts";

const DSN = "https://abc123@o1.ingest.sentry.io/42";
const ORDERS_URL = "https://api.example.com/orders";
const DEPARTURES_URL = "https://api.example.com/departures";
const HANG_CAP_MS = 3500;
const realFetch = globalThis.fetch;
const savedEnv = { ...process.env };

interface Call {
  body: string;
  url: string;
}
let sentry: Call[];
let pings: string[];
let sentryHangs = false;
const targetStatuses: Record<string, number> = {};

function installFetch() {
  globalThis.fetch = ((input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("sentry.io")) {
      sentry.push({ url, body: String(init?.body ?? "") });
      if (sentryHangs) {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted"))
          );
        });
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    }
    pings.push(url);
    return Promise.resolve(
      new Response("{}", { status: targetStatuses[url] ?? 200 })
    );
  }) as typeof fetch;
}

async function run() {
  const result: { body?: unknown; status?: number } = {};
  await handler({
    req: { headers: { "x-appwrite-trigger": "schedule" }, method: "POST" },
    res: {
      json: (data: unknown, status = 200) => {
        result.body = data;
        result.status = status;
        return result;
      },
    },
    log: () => undefined,
    error: () => undefined,
  });
  return result;
}

function checkIns(): { slug: string; status: string }[] {
  return sentry
    .filter((c) => c.url.includes("/cron/"))
    .map((c) => {
      const url = new URL(c.url);
      return {
        slug: url.pathname.split("/")[4] ?? "",
        status: url.searchParams.get("status") ?? "",
      };
    });
}

const statusesFor = (slug: string) =>
  checkIns()
    .filter((c) => c.slug === slug)
    .map((c) => c.status);

beforeEach(() => {
  sentry = [];
  pings = [];
  sentryHangs = false;
  for (const key of Object.keys(targetStatuses)) {
    delete targetStatuses[key];
  }
  for (const key of Object.keys(process.env)) {
    if (key.endsWith("_URL") || key === "SENTRY_DSN") {
      delete process.env[key];
    }
  }
  process.env.CRON_SECRET = "s3cret";
  process.env.ORDERS_RECONCILE_URL = ORDERS_URL;
  process.env.DEPARTURES_SYNC_URL = DEPARTURES_URL;
  targetStatuses[ORDERS_URL] = 500;
  installFetch();
});

afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...savedEnv };
});

describe("monitorSlugFor", () => {
  test("derives the slug from the env var name", () => {
    expect(monitorSlugFor("ORDERS_RECONCILE_URL")).toBe(
      "dispatch-orders-reconcile"
    );
    expect(monitorSlugFor("RECRUITMENT_RETENTION_CLEANUP_URL")).toBe(
      "dispatch-recruitment-retention-cleanup"
    );
  });
});

describe("scheduled-dispatch reporting", () => {
  test("reports check-ins and one error when a target fails", async () => {
    process.env.SENTRY_DSN = DSN;
    const result = await run();
    expect(result.status).toBe(502);
    expect(checkIns()).toHaveLength(4);
    expect(statusesFor("scheduled-dispatch")).toEqual(["in_progress", "error"]);
    expect(statusesFor("dispatch-orders-reconcile")).toEqual(["error"]);
    expect(statusesFor("dispatch-departures-sync")).toEqual(["ok"]);
    const errors = sentry.filter((c) =>
      c.body.includes("ORDERS_RECONCILE_URL failed: 500")
    );
    expect(errors).toHaveLength(1);
  });

  test("makes no Sentry calls without a DSN and responds the same", async () => {
    const result = await run();
    expect(sentry).toHaveLength(0);
    expect(result.status).toBe(502);
    expect(pings).toHaveLength(2);
  });

  test("an unset target produces no check-in", async () => {
    process.env.SENTRY_DSN = DSN;
    await run();
    expect(statusesFor("dispatch-tickster-sync")).toEqual([]);
  });

  test("a hanging Sentry does not delay the response past the cap", async () => {
    process.env.SENTRY_DSN = DSN;
    sentryHangs = true;
    const started = Date.now();
    const result = await run();
    expect(result.status).toBe(502);
    expect(Date.now() - started).toBeLessThan(HANG_CAP_MS);
  });
});
