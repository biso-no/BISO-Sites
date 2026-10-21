import { expect, test } from "bun:test";
import { classifyTrigger } from "./trigger";

const SECRET = "s3cret";

function event(name: string) {
  return { "x-appwrite-event": name, "x-appwrite-trigger": "event" };
}

test("a news update event becomes a content trigger", () => {
  expect(
    classifyTrigger(event("tablesdb.app.tables.news.rows.n1.update"), SECRET)
  ).toEqual({ id: "n1", kind: "content", type: "news" });
});

test("create events for events and jobs become content triggers", () => {
  expect(
    classifyTrigger(event("tablesdb.app.tables.events.rows.e1.create"), SECRET)
  ).toEqual({ id: "e1", kind: "content", type: "event" });
  expect(
    classifyTrigger(event("tablesdb.app.tables.jobs.rows.j1.create"), SECRET)
  ).toEqual({ id: "j1", kind: "content", type: "job" });
});

test("an event on another table is rejected with 400", () => {
  expect(
    classifyTrigger(event("tablesdb.app.tables.campus.rows.x.update"), SECRET)
  ).toMatchObject({ kind: "reject", status: 400 });
});

test("a delete event is rejected with 400", () => {
  expect(
    classifyTrigger(event("tablesdb.app.tables.news.rows.n1.delete"), SECRET)
  ).toMatchObject({ kind: "reject", status: 400 });
});

test("an event without a header name is rejected with 400", () => {
  expect(
    classifyTrigger({ "x-appwrite-trigger": "event" }, SECRET)
  ).toMatchObject({ kind: "reject", status: 400 });
});

test("wildcards in the event header fall back to the body", () => {
  expect(
    classifyTrigger(event("tablesdb.app.tables.*.rows.*.update"), SECRET, {
      $id: "n9",
      $tableId: "news",
    })
  ).toEqual({ id: "n9", kind: "content", type: "news" });
  expect(
    classifyTrigger(event("tablesdb.app.tables.jobs.rows.*.create"), SECRET, {
      $id: "j9",
    })
  ).toEqual({ id: "j9", kind: "content", type: "job" });
});

test("wildcards without a usable body are rejected with 400", () => {
  expect(
    classifyTrigger(event("tablesdb.app.tables.*.rows.*.update"), SECRET, null)
  ).toMatchObject({ kind: "reject", status: 400 });
  expect(
    classifyTrigger(event("tablesdb.app.tables.*.rows.*.update"), SECRET, {
      $id: "x",
      $tableId: "campus",
    })
  ).toMatchObject({ kind: "reject", status: 400 });
});

test("a schedule trigger dispatches", () => {
  expect(classifyTrigger({ "x-appwrite-trigger": "schedule" }, SECRET)).toEqual(
    { kind: "dispatch" }
  );
});

test("an http ping dispatches with x-cron-secret or a bearer token", () => {
  expect(
    classifyTrigger(
      { "x-appwrite-trigger": "http", "x-cron-secret": SECRET },
      SECRET
    )
  ).toEqual({ kind: "dispatch" });
  expect(
    classifyTrigger(
      { authorization: `Bearer ${SECRET}`, "x-appwrite-trigger": "http" },
      SECRET
    )
  ).toEqual({ kind: "dispatch" });
});

test("an http ping with a wrong or missing secret is 401", () => {
  expect(
    classifyTrigger(
      { "x-appwrite-trigger": "http", "x-cron-secret": "nope" },
      SECRET
    )
  ).toMatchObject({ kind: "reject", status: 401 });
  expect(
    classifyTrigger({ "x-appwrite-trigger": "http" }, SECRET)
  ).toMatchObject({ kind: "reject", status: 401 });
});

test("an http ping without a configured secret is 500", () => {
  expect(
    classifyTrigger(
      { "x-appwrite-trigger": "http", "x-cron-secret": SECRET },
      undefined
    )
  ).toMatchObject({ kind: "reject", status: 500 });
});

test("an unknown trigger is rejected with 400", () => {
  expect(classifyTrigger({}, SECRET)).toMatchObject({
    kind: "reject",
    status: 400,
  });
});

test("legacy databases events classify like tablesdb ones", () => {
  expect(
    classifyTrigger(event("databases.app.tables.news.rows.n1.update"), SECRET)
  ).toEqual({ id: "n1", kind: "content", type: "news" });
  expect(
    classifyTrigger(
      event("databases.app.collections.events.documents.e1.create"),
      SECRET
    )
  ).toEqual({ id: "e1", kind: "content", type: "event" });
  expect(
    classifyTrigger(
      event("databases.app.collections.campus.documents.c1.update"),
      SECRET
    )
  ).toMatchObject({ kind: "reject", status: 400 });
  expect(
    classifyTrigger(
      event("tablesdb.app.collections.news.documents.n1.update"),
      SECRET
    )
  ).toMatchObject({ kind: "reject", status: 400 });
});
