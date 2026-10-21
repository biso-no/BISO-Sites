import { expect, mock, test } from "bun:test";
import type { ContentNotifications } from "@repo/api/types/appwrite";
import { handleRequest, readEventBody } from "./handler";
import type { NotifierDeps } from "./run";

const SECRET = "s3cret";

function deps(): NotifierDeps {
  return {
    createAnnouncement: mock(() => Promise.reject(new Error("unused"))),
    createLock: mock(() => Promise.resolve("created" as const)),
    delayMinutes: 3,
    dispatch: mock(() => Promise.resolve()),
    error: mock(() => undefined),
    getContent: mock(() => Promise.resolve(null)),
    getLock: mock(() => Promise.resolve(null)),
    getTranslations: mock(() => Promise.resolve([])),
    listDueLocks: mock(() => Promise.resolve([])),
    log: mock(() => undefined),
    updateLock: mock(() => Promise.resolve()),
  };
}

/** A request whose `bodyJson` getter throws, like an empty body does at runtime. */
function throwingReq(headers: Record<string, string>) {
  return {
    bodyText: "",
    get bodyJson(): unknown {
      throw new SyntaxError("Unexpected end of JSON input");
    },
    headers,
  };
}

const NOW = new Date("2026-10-21T10:00:00.000Z");

test("readEventBody returns null for empty or invalid bodies", () => {
  expect(readEventBody({ bodyText: "" })).toBeNull();
  expect(readEventBody({ bodyText: "{nope" })).toBeNull();
  expect(readEventBody(throwingReq({}))).toBeNull();
  expect(readEventBody({ bodyText: '{"$id":"n1"}' })).toEqual({ $id: "n1" });
  expect(readEventBody({ bodyJson: { $id: "n2" } })).toEqual({ $id: "n2" });
});

test("an empty-body http ping with the secret reaches dispatch", async () => {
  const d = deps();
  const result = await handleRequest({
    deps: d,
    isDispatchRunning: () => Promise.resolve(false),
    now: NOW,
    req: throwingReq({ "x-appwrite-trigger": "http", "x-cron-secret": SECRET }),
    secret: SECRET,
  });
  expect(result.status).toBe(200);
  expect(result.body).toEqual({
    announcements: 0,
    cancelled: 0,
    failed: 0,
    sent: 0,
  });
  expect(d.listDueLocks).toHaveBeenCalledTimes(1);
});

test("a dispatch pass with failures answers 500 with its counts", async () => {
  const d = deps();
  d.listDueLocks = mock(() =>
    Promise.resolve([
      {
        $id: "event_e1",
        content_id: "e1",
        content_type: "event",
        due_at: "2026-10-21T09:55:00.000Z",
        status: "pending",
      } as unknown as ContentNotifications,
    ])
  );
  d.getContent = mock(() => Promise.reject(new Error("upstream timeout")));

  const result = await handleRequest({
    deps: d,
    isDispatchRunning: () => Promise.resolve(false),
    now: NOW,
    req: { headers: { "x-appwrite-trigger": "schedule" } },
    secret: undefined,
  });

  expect(result).toEqual({
    body: { announcements: 0, cancelled: 0, failed: 1, sent: 0 },
    status: 500,
  });
  expect(d.error).toHaveBeenCalledTimes(1);
});

test("a schedule run reaches dispatch", async () => {
  const d = deps();
  const result = await handleRequest({
    deps: d,
    isDispatchRunning: () => Promise.resolve(false),
    now: NOW,
    req: throwingReq({ "x-appwrite-trigger": "schedule" }),
    secret: undefined,
  });
  expect(result.status).toBe(200);
  expect(d.listDueLocks).toHaveBeenCalledTimes(1);
});

test("an event with an invalid body still classifies from the header", async () => {
  const d = deps();
  const result = await handleRequest({
    deps: d,
    isDispatchRunning: () => Promise.resolve(false),
    now: NOW,
    req: {
      bodyText: "{broken",
      headers: {
        "x-appwrite-event": "tablesdb.app.tables.news.rows.n1.update",
        "x-appwrite-trigger": "event",
      },
    },
    secret: SECRET,
  });
  expect(result.status).toBe(200);
  expect(d.getContent).toHaveBeenCalledWith("news", "n1");
});

test("a busy dispatch skips with 200 and does not list locks", async () => {
  const d = deps();
  const result = await handleRequest({
    deps: d,
    isDispatchRunning: () => Promise.resolve(true),
    now: NOW,
    req: { headers: { "x-appwrite-trigger": "schedule" } },
    secret: undefined,
  });
  expect(result).toEqual({
    body: { ok: true, skipped: "already-running" },
    status: 200,
  });
  expect(d.listDueLocks).not.toHaveBeenCalled();
});

test("a rejected trigger returns its status", async () => {
  const result = await handleRequest({
    deps: deps(),
    isDispatchRunning: () => Promise.resolve(false),
    now: NOW,
    req: { headers: { "x-appwrite-trigger": "http" } },
    secret: SECRET,
  });
  expect(result.status).toBe(401);
});
