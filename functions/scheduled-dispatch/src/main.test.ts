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
const targetGates: Record<string, Promise<void>> = {};
const targetBodies: Record<string, string> = {};

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
    const respond = () =>
      new Response(targetBodies[url] ?? "{}", {
        status: targetStatuses[url] ?? 200,
      });
    const gate = targetGates[url];
    return gate ? gate.then(respond) : Promise.resolve(respond());
  }) as typeof fetch;
}

async function run(log: (...messages: unknown[]) => void = () => undefined) {
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
    log,
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

function checkInDetails(slug: string) {
  return sentry
    .filter((c) => c.url.includes(`/cron/${slug}/`))
    .map((c) => {
      const body = JSON.parse(c.body);
      return {
        id: body.check_in_id as string,
        maxRuntime: body.monitor_config?.max_runtime as number | undefined,
        status: body.status as string,
      };
    });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

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
  for (const key of [
    ...Object.keys(targetGates),
    ...Object.keys(targetBodies),
  ]) {
    delete targetGates[key];
    delete targetBodies[key];
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

describe("scheduled-dispatch targets", () => {
  test("pings the big event messages target with 300 seconds to answer", async () => {
    const messagesUrl = "https://api.example.com/big-event-messages";
    process.env.BIG_EVENT_MESSAGES_URL = messagesUrl;
    const lines: string[] = [];
    await run((...messages) => lines.push(messages.join(" ")));
    expect(pings).toContain(messagesUrl);
    expect(
      lines.some((line) => line.includes("BIG_EVENT_MESSAGES_URL@300000ms"))
    ).toBe(true);
  });
});

describe("scheduled-dispatch reporting", () => {
  test("reports check-ins and one error when a target fails", async () => {
    process.env.SENTRY_DSN = DSN;
    const result = await run();
    expect(result.status).toBe(502);
    expect(checkIns()).toHaveLength(6);
    expect(statusesFor("scheduled-dispatch")).toEqual(["in_progress", "error"]);
    expect(statusesFor("dispatch-orders-reconcile")).toEqual([
      "in_progress",
      "error",
    ]);
    expect(statusesFor("dispatch-departures-sync")).toEqual([
      "in_progress",
      "ok",
    ]);
    const errors = sentry.filter((c) =>
      c.body.includes("ORDERS_RECONCILE_URL failed: 500")
    );
    expect(errors).toHaveLength(1);
  });

  test("names a failure reported in a 2xx body", async () => {
    process.env.SENTRY_DSN = DSN;
    targetStatuses[ORDERS_URL] = 200;
    targetBodies[ORDERS_URL] = JSON.stringify({ ok: false });
    await run();
    expect(
      sentry.some((c) =>
        c.body.includes(
          "ORDERS_RECONCILE_URL failed: 200 (body reported failure)"
        )
      )
    ).toBe(true);
  });

  test("closes a fast target before a slow one finishes, with matching ids and per-target max runtime", async () => {
    process.env.SENTRY_DSN = DSN;
    targetStatuses[ORDERS_URL] = 200;
    let release: () => void = () => undefined;
    targetGates[ORDERS_URL] = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = run();
    await tick();
    expect(statusesFor("dispatch-departures-sync")).toEqual([
      "in_progress",
      "ok",
    ]);
    expect(statusesFor("dispatch-orders-reconcile")).toEqual(["in_progress"]);
    release();
    await running;
    for (const slug of [
      "dispatch-departures-sync",
      "dispatch-orders-reconcile",
    ]) {
      const [open, close] = checkInDetails(slug);
      expect(open?.status).toBe("in_progress");
      expect(close?.status).toBe("ok");
      expect(close?.id).toBe(open?.id);
    }
    expect(checkInDetails("dispatch-departures-sync")[0]?.maxRuntime).toBe(2);
    expect(checkInDetails("dispatch-orders-reconcile")[0]?.maxRuntime).toBe(6);
    expect(checkInDetails("scheduled-dispatch")[0]?.maxRuntime).toBe(6);
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
