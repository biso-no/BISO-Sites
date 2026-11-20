import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { reporterFromEnv } from "@repo/observability/functions";
import { runMonitored } from "./report";
import type { SyncResult } from "./run";

const DSN = "https://abc123@o42.ingest.de.sentry.io/777";
const realFetch = globalThis.fetch;
let calls: { body: string; url: string }[] = [];

beforeEach(() => {
  calls = [];
  globalThis.fetch = ((url: string, init?: { body?: string }) => {
    calls.push({ body: String(init?.body ?? ""), url: String(url) });
    return Promise.resolve(new Response("{}"));
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const DONE: SyncResult = {
  durationMs: 5,
  members: 3,
  ok: true,
  removed: 0,
  unknownCampus: 0,
};

function reporter(dsn: string | undefined = DSN) {
  return reporterFromEnv({ SENTRY_DSN: dsn }, "member-roster-sync");
}

/** Cron check-in requests, by status, in call order. */
function checkIns() {
  return calls
    .filter((call) => call.url.includes("/cron/member-roster-sync/"))
    .map((call) => new URL(call.url).searchParams.get("status"));
}

describe("runMonitored", () => {
  it("opens in_progress with the monitor config, closes ok, returns the result", async () => {
    const r = reporter();
    const result = await runMonitored(r, () => Promise.resolve(DONE), {});
    await r.flush();
    expect(result).toBe(DONE);
    expect(checkIns()).toEqual(["in_progress", "ok"]);
    const open = calls.find((call) => call.url.includes("in_progress"));
    expect(open?.body).toContain("0 3 * * *");
    expect(open?.body).toContain('"checkin_margin":30');
  });

  it("takes the schedule from MEMBER_ROSTER_SYNC_SCHEDULE", async () => {
    const r = reporter();
    await runMonitored(r, () => Promise.resolve(DONE), {
      MEMBER_ROSTER_SYNC_SCHEDULE: "15 4 * * 1",
    });
    await r.flush();
    const open = calls.find((call) => call.url.includes("in_progress"));
    expect(open?.body).toContain("15 4 * * 1");
  });

  it("closes ok for an overlap skip without an error event", async () => {
    const r = reporter();
    const skipped: SyncResult = { ok: true, skipped: "already-running" };
    const result = await runMonitored(r, () => Promise.resolve(skipped), {});
    await r.flush();
    expect(result).toBe(skipped);
    expect(checkIns()).toEqual(["in_progress", "ok"]);
    expect(calls.some((call) => call.url.includes("/envelope/"))).toBe(false);
  });

  it("closes error, captures, and rethrows when the run throws", async () => {
    const r = reporter();
    await expect(
      runMonitored(r, () => Promise.reject(new Error("24SO down")), {})
    ).rejects.toThrow("24SO down");
    await r.flush();
    expect(checkIns()).toEqual(["in_progress", "error"]);
    expect(
      calls.some(
        (call) =>
          call.url.includes("/envelope/") && call.body.includes("24SO down")
      )
    ).toBe(true);
  });

  it("closes error with a data-free message when ok is false", async () => {
    const r = reporter();
    const failed = { ok: false } as unknown as SyncResult;
    await runMonitored(r, () => Promise.resolve(failed), {});
    await r.flush();
    expect(checkIns()).toEqual(["in_progress", "error"]);
    expect(
      calls.some((call) => call.body.includes("member-roster-sync failed"))
    ).toBe(true);
  });

  it("makes no network call without a DSN", async () => {
    const r = reporter("");
    await runMonitored(r, () => Promise.resolve(DONE), {});
    await r.flush();
    expect(calls).toHaveLength(0);
  });
});
