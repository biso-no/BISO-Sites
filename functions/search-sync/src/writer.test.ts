import { describe, expect, it } from "bun:test";
import { baseEntry } from "@repo/shared/search/entries/common";
import { SEARCH_INDEX_SETTINGS } from "@repo/shared/search/settings";
import type { SearchEntry } from "@repo/shared/search/types";
import type { Meilisearch } from "meilisearch";
import { meiliWriter } from "./writer";

const FAILED_BAD_FILTER = /Meilisearch task 7 failed: bad filter/;
const FAILED_CANCELED = /Meilisearch task 7 failed: canceled/;

interface Call {
  args: unknown[];
  index: string;
  method: string;
  timeout: number | undefined;
}

interface FakeOptions {
  error?: string;
  taskStatus?: "succeeded" | "failed" | "canceled";
}

/** A Meilisearch client whose every task ends with `taskStatus`. */
function fakeClient(options: FakeOptions = {}) {
  const calls: Call[] = [];
  const task = (index: string, method: string, args: unknown[]) => ({
    waitTask: (wait?: { timeout?: number }) => {
      calls.push({ args, index, method, timeout: wait?.timeout });
      const status = options.taskStatus ?? "succeeded";
      return Promise.resolve({
        error: options.error
          ? { code: "x", link: "", message: options.error, type: "x" }
          : null,
        status,
        uid: 7,
      });
    },
  });
  const client = {
    index: (name: string) => ({
      addDocuments: (...args: unknown[]) => task(name, "addDocuments", args),
      deleteDocuments: (...args: unknown[]) =>
        task(name, "deleteDocuments", args),
      updateSettings: (...args: unknown[]) =>
        task(name, "updateSettings", args),
    }),
  };
  return { calls, client: client as unknown as Meilisearch };
}

function entry(locale: "no" | "en"): SearchEntry {
  return baseEntry(
    {
      campusId: "all",
      locale,
      rowId: "e1",
      textLocale: locale,
      type: "event",
      url: "/events/e1",
    },
    { syncedAt: 1 }
  );
}

describe("meiliWriter", () => {
  it("throws when a task ends failed", async () => {
    const { client } = fakeClient({
      error: "bad filter",
      taskStatus: "failed",
    });
    await expect(
      meiliWriter(client, "site_content").deleteItem("event", "e1")
    ).rejects.toThrow(FAILED_BAD_FILTER);
  });

  it("throws when a task is canceled", async () => {
    const { client } = fakeClient({ taskStatus: "canceled" });
    await expect(
      meiliWriter(client, "site_content").upsert([entry("no")])
    ).rejects.toThrow(FAILED_CANCELED);
  });

  it("upserts by id and waits 10 s by default", async () => {
    const { calls, client } = fakeClient();
    const entries = [entry("no"), entry("en")];
    await meiliWriter(client, "site_content").upsert(entries);
    expect(calls).toEqual([
      {
        args: [entries, { primaryKey: "id" }],
        index: "site_content",
        method: "addDocuments",
        timeout: 10_000,
      },
    ]);
  });

  it("skips an empty upsert", async () => {
    const { calls, client } = fakeClient();
    await meiliWriter(client, "site_content").upsert([]);
    expect(calls).toEqual([]);
  });

  it("deletes an item by type and row id", async () => {
    const { calls, client } = fakeClient();
    await meiliWriter(client, "site_test", { timeoutMs: 500 }).deleteItem(
      "page",
      "p1"
    );
    expect(calls).toEqual([
      {
        args: [{ filter: 'type = "page" AND row_id = "p1"' }],
        index: "site_test",
        method: "deleteDocuments",
        timeout: 500,
      },
    ]);
  });

  it("quotes row ids inside the filter", async () => {
    const { calls, client } = fakeClient();
    await meiliWriter(client, "site_content").deleteItem("page", 'a"b\\c');
    expect(calls[0]?.args).toEqual([
      { filter: 'type = "page" AND row_id = "a\\"b\\\\c"' },
    ]);
  });

  it("sweeps entries older than a sync time", async () => {
    const { calls, client } = fakeClient();
    await meiliWriter(client, "site_content").deleteOlderThan(
      1_700_000_000_000
    );
    expect(calls[0]).toMatchObject({
      args: [{ filter: "synced_at < 1700000000000" }],
      method: "deleteDocuments",
    });
  });

  it("applies the shared index settings", async () => {
    const { calls, client } = fakeClient();
    await meiliWriter(client, "site_content").applySettings();
    expect(calls[0]).toMatchObject({
      args: [SEARCH_INDEX_SETTINGS],
      method: "updateSettings",
    });
  });
});
