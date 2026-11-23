import { describe, expect, it } from "bun:test";
import { baseEntry } from "@repo/shared/search/entries/common";
import type { SearchEntry } from "@repo/shared/search/types";
import { handleRequest, type RequestLike } from "./handler";
import type { LoadedItem, Source } from "./source";
import type { SyncDeps } from "./sync";
import type { IndexWriter } from "./writer";

const SECRET = "s3cret";

const eventEntry: SearchEntry = baseEntry(
  {
    campusId: "all",
    locale: "no",
    rowId: "e1",
    textLocale: "no",
    type: "event",
    url: "/events/e1",
  },
  { syncedAt: 1 }
);

const quietSource: Source = {
  departmentRelated: () => Promise.resolve([]),
  async *listIds() {
    yield* [];
  },
  load: () =>
    Promise.resolve<LoadedItem>({
      entries: [eventEntry, { ...eventEntry, id: "event_e1_en", locale: "en" }],
      related: [],
    }),
  servableProjectPaths: () => Promise.resolve(new Map()),
};

const throwingSource: Source = {
  ...quietSource,
  load: () => Promise.reject(new Error("Appwrite timed out")),
};

const writer: IndexWriter = {
  applySettings: () => Promise.resolve(),
  deleteIds: () => Promise.resolve(),
  deleteItem: () => Promise.resolve(),
  deleteOlderThan: () => Promise.resolve(),
  getEntry: () => Promise.resolve(null),
  upsert: () => Promise.resolve(),
};

interface InputOptions extends RequestLike {
  reindex?: () => Promise<Record<string, unknown>>;
  settle?: () => Promise<void>;
  source?: Source;
}

const eventHeaders = {
  "x-appwrite-event": "tablesdb.app.tables.events.rows.e1.update",
  "x-appwrite-trigger": "event",
};

function input(options: InputOptions = {}) {
  const { reindex, settle, source, ...req } = options;
  const deps: SyncDeps = {
    log: () => undefined,
    now: () => new Date("2026-11-23T12:00:00Z"),
    source: source ?? quietSource,
    writer,
  };
  return {
    deps,
    reindex: reindex ?? (() => Promise.resolve({ ok: true })),
    settle: settle ?? (() => Promise.resolve()),
    req: {
      bodyText: req.bodyText ?? JSON.stringify({ $id: "e1" }),
      headers: req.headers ?? eventHeaders,
      ...(req.bodyJson === undefined ? {} : { bodyJson: req.bodyJson }),
    },
    secret: SECRET,
  };
}

describe("handleRequest", () => {
  it("answers 200 ignored for a translation it does not index", async () => {
    expect(
      await handleRequest(
        input({
          bodyText: JSON.stringify({
            content_id: "b1",
            content_type: "memberBenefit",
          }),
          headers: {
            "x-appwrite-event":
              "tablesdb.app.tables.content_translations.rows.t1.update",
            "x-appwrite-trigger": "event",
          },
        })
      )
    ).toMatchObject({
      body: { ignored: expect.any(String), ok: true },
      status: 200,
    });
  });

  it("answers 200 ignored for a table it does not index", async () => {
    expect(
      await handleRequest(
        input({
          headers: {
            "x-appwrite-event": "tablesdb.app.tables.orders.rows.o1.create",
            "x-appwrite-trigger": "event",
          },
        })
      )
    ).toMatchObject({ body: { ok: true }, status: 200 });
  });

  it("syncs a row event and answers its counts", async () => {
    expect(await handleRequest(input())).toEqual({
      body: { deleted: 0, ok: true, upserted: 2 },
      status: 200,
    });
  });

  it("waits for related writes to settle before reading a row event", async () => {
    const order: string[] = [];
    const result = await handleRequest(
      input({
        settle: () => {
          order.push("settle");
          return Promise.resolve();
        },
        source: {
          ...quietSource,
          load: (...args) => {
            order.push("load");
            return quietSource.load(...args);
          },
        },
      })
    );
    expect(result.status).toBe(200);
    expect(order).toEqual(["settle", "load"]);
  });

  it("does not wait for the reindex or an ignored event", async () => {
    let waits = 0;
    const settle = () => {
      waits += 1;
      return Promise.resolve();
    };
    await handleRequest(
      input({
        headers: { "x-appwrite-trigger": "http", "x-cron-secret": SECRET },
        settle,
      })
    );
    await handleRequest(
      input({
        headers: {
          "x-appwrite-event": "tablesdb.app.tables.orders.rows.o1.create",
          "x-appwrite-trigger": "event",
        },
        settle,
      })
    );
    expect(waits).toBe(0);
  });

  it("answers 500 when loading fails", async () => {
    const result = await handleRequest(input({ source: throwingSource }));
    expect(result.status).toBe(500);
    expect(result.body).toEqual({ error: "Appwrite timed out", ok: false });
  });

  it("answers a rejected trigger with its status", async () => {
    expect(await handleRequest(input({ headers: {} }))).toEqual({
      body: { error: "Unknown trigger: none", ok: false },
      status: 400,
    });
    const unauthorized = await handleRequest(
      input({ headers: { "x-appwrite-trigger": "http" } })
    );
    expect(unauthorized.status).toBe(401);
  });

  it("runs the reindex for an authorised http call", async () => {
    const result = await handleRequest(
      input({
        headers: { "x-appwrite-trigger": "http", "x-cron-secret": SECRET },
        reindex: () => Promise.resolve({ entries: 12, ok: true }),
      })
    );
    expect(result).toEqual({ body: { entries: 12, ok: true }, status: 200 });
  });

  it("answers 500 when the reindex throws", async () => {
    const result = await handleRequest(
      input({
        headers: { "x-appwrite-trigger": "http", "x-cron-secret": SECRET },
        reindex: () =>
          Promise.reject(new Error("Reindex is not implemented yet")),
      })
    );
    expect(result).toEqual({
      body: { error: "Reindex is not implemented yet", ok: false },
      status: 500,
    });
  });

  it("reads the event body from bodyJson when bodyText is empty", async () => {
    // The wildcard event can only be classified from the body's ids.
    const result = await handleRequest(
      input({
        bodyJson: {
          $id: "t1",
          $tableId: "content_translations",
          content_id: "b1",
          content_type: "memberBenefit",
        },
        bodyText: "",
        headers: {
          "x-appwrite-event": "tablesdb.app.tables.*.rows.*.update",
          "x-appwrite-trigger": "event",
        },
      })
    );
    expect(result).toMatchObject({
      body: { ignored: expect.any(String), ok: true },
      status: 200,
    });
  });

  it("survives a bodyJson getter that throws", async () => {
    const req = {
      bodyText: "",
      get bodyJson(): unknown {
        throw new SyntaxError("Unexpected end of JSON input");
      },
      headers: eventHeaders,
    };
    const result = await handleRequest({ ...input(), req });
    expect(result.status).toBe(200);
  });
});
