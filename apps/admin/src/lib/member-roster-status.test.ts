import { expect, test } from "bun:test";
import { summarizeRosterExecutions } from "./member-roster-status";

const ok = (at: string) => ({
  $updatedAt: at,
  responseStatusCode: 200,
  status: "completed",
});

test("last refreshed is the newest successful execution", () => {
  expect(
    summarizeRosterExecutions([
      ok("2026-09-29T03:01:00Z"),
      ok("2026-09-28T03:01:00Z"),
    ])
  ).toEqual({
    lastFailedAt: null,
    lastRefreshedAt: "2026-09-29T03:01:00Z",
    running: false,
  });
});

test("a completed execution that returned 500 counts as failed", () => {
  const status = summarizeRosterExecutions([
    {
      $updatedAt: "2026-09-29T03:01:00Z",
      responseStatusCode: 500,
      status: "completed",
    },
    ok("2026-09-28T03:01:00Z"),
  ]);
  expect(status).toEqual({
    lastFailedAt: "2026-09-29T03:01:00Z",
    lastRefreshedAt: "2026-09-28T03:01:00Z",
    running: false,
  });
});

test("an older failure is not reported once a newer run succeeded", () => {
  const status = summarizeRosterExecutions([
    ok("2026-09-29T03:01:00Z"),
    {
      $updatedAt: "2026-09-28T03:01:00Z",
      responseStatusCode: 0,
      status: "failed",
    },
  ]);
  expect(status.lastFailedAt).toBeNull();
});

test("waiting or processing means running", () => {
  for (const status of ["waiting", "processing"]) {
    expect(
      summarizeRosterExecutions([
        { $updatedAt: "x", responseStatusCode: 0, status },
      ]).running
    ).toBe(true);
  }
});

test("no executions at all", () => {
  expect(summarizeRosterExecutions([])).toEqual({
    lastFailedAt: null,
    lastRefreshedAt: null,
    running: false,
  });
});

test("a run that skipped because another was running is not a refresh", () => {
  const status = summarizeRosterExecutions([
    {
      $updatedAt: "2026-09-30T03:01:00Z",
      responseStatusCode: 409,
      status: "completed",
    },
    ok("2026-09-28T03:01:00Z"),
  ]);
  expect(status).toEqual({
    lastFailedAt: null,
    lastRefreshedAt: "2026-09-28T03:01:00Z",
    running: false,
  });
});

test("a processing record older than the function timeout is stale, not running", () => {
  const now = Date.parse("2026-09-29T12:00:00Z");
  const stale = {
    $createdAt: "2026-09-29T03:00:00Z",
    $updatedAt: "2026-09-29T03:00:00Z",
    responseStatusCode: 0,
    status: "processing",
  };
  const fresh = { ...stale, $createdAt: "2026-09-29T11:55:00Z" };
  expect(summarizeRosterExecutions([stale], now).running).toBe(false);
  expect(summarizeRosterExecutions([fresh], now).running).toBe(true);
});
