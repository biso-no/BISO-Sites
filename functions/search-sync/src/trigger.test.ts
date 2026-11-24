import { describe, expect, it } from "bun:test";
import { classifyTrigger } from "./trigger";

describe("classifyTrigger", () => {
  it("parses a concrete row event", () => {
    expect(
      classifyTrigger(
        {
          "x-appwrite-trigger": "event",
          "x-appwrite-event": "tablesdb.app.tables.events.rows.e1.update",
        },
        "s",
        null
      )
    ).toMatchObject({
      kind: "row",
      table: "events",
      id: "e1",
      action: "update",
    });
  });

  it("fills wildcard segments from the body", () => {
    expect(
      classifyTrigger(
        {
          "x-appwrite-trigger": "event",
          "x-appwrite-event": "databases.app.tables.*.rows.*.delete",
        },
        "s",
        { $tableId: "news", $id: "n1" }
      )
    ).toMatchObject({ kind: "row", table: "news", id: "n1", action: "delete" });
  });

  it("rejects unparseable events with 400", () => {
    expect(
      classifyTrigger(
        {
          "x-appwrite-trigger": "event",
          "x-appwrite-event": "users.u1.create",
        },
        "s",
        null
      )
    ).toMatchObject({ kind: "reject", status: 400 });
  });

  it("accepts the secret by header or bearer", () => {
    expect(
      classifyTrigger(
        { "x-appwrite-trigger": "http", "x-cron-secret": "s" },
        "s",
        null
      )
    ).toEqual({ kind: "reindex" });
    expect(
      classifyTrigger(
        { "x-appwrite-trigger": "http", authorization: "Bearer s" },
        "s",
        null
      )
    ).toEqual({ kind: "reindex" });
  });

  it("rejects a wrong secret with 401 and a missing config with 500", () => {
    expect(
      classifyTrigger(
        { "x-appwrite-trigger": "http", authorization: "Bearer nope" },
        "s",
        null
      )
    ).toMatchObject({ kind: "reject", status: 401 });
    expect(
      classifyTrigger({ "x-appwrite-trigger": "http" }, undefined, null)
    ).toMatchObject({ kind: "reject", status: 500 });
  });

  it("rejects schedule and unknown triggers with 400", () => {
    expect(
      classifyTrigger({ "x-appwrite-trigger": "schedule" }, "s", null)
    ).toMatchObject({ kind: "reject", status: 400 });
    expect(classifyTrigger({}, "s", null)).toMatchObject({
      kind: "reject",
      status: 400,
    });
  });
});
